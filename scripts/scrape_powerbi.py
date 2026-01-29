import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import requests
from playwright.sync_api import sync_playwright

BASE_DIR = HERE = Path(__file__).resolve().parent
POWERBI_BASE_URL = (
    "https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports"
)


@dataclass
class Facility:
    name: str
    services: list[str]
    lara_id: str | None
    website: str | None
    phone: str | None
    address: str | None
    city: str | None
    zipcode: str | None
    accepts_medicaid: bool
    coordinates: tuple[float, float] | None


def clean_facility(
    result: dict[str, Any], coordinates_map: dict[str, tuple[float, float]]
) -> Facility:
    services = result["M0"]
    if isinstance(services, str):
        services = services.split("; ")
    else:
        services = []

    address_key = (
        f"{result.get('M12', '')}{result.get('M11', '')}{result.get('M10', '')}"
    )
    # We want this to fail loudly so we're alerted when new addresses show up
    coordinates = coordinates_map[address_key]

    return Facility(
        name=result["G0"],
        services=services,
        lara_id=result.get("M7"),
        website=result.get("M8"),
        phone=result.get("M9"),
        address=result.get("M12"),
        city=result.get("M11"),
        zipcode=result.get("M10"),
        accepts_medicaid=result.get("M13") == "Y",
        coordinates=coordinates,
    )


def load_coordinates() -> dict[str, (float, float)]:
    with Path.open(BASE_DIR / "addresses.csv", "r") as f:
        rows = [row for row in csv.DictReader(f)]

    output_dict = {}
    for row in rows:
        output_dict[f"{row['address']}{row['city']}{row['zipcode']}"] = (
            float(row["latitude"]),
            float(row["longitude"]),
        )
    return output_dict


def parse_powerbi_dm0(dm0_data):
    if not dm0_data:
        return []

    # Get schema from first object
    first_obj = dm0_data[0]
    schema = first_obj.get("S", [])
    column_names = [col["N"] for col in schema]

    records = []
    previous_values = {}

    for obj in dm0_data:
        c_values = obj.get("C", [])
        r_value = obj.get("R")  # Reuse bitmap
        null_value = obj.get("Ø") or obj.get("N")  # Null bitmap (can be Ø or N)

        record = {}
        c_idx = 0

        for col_idx, col_name in enumerate(column_names):
            # Priority 1: Check if this position is NULL (Ø bitmap)
            if null_value is not None and (null_value & (1 << col_idx)):
                record[col_name] = None
            # Priority 2: Check if this position should REUSE previous value (R bitmap)
            elif r_value is not None and (r_value & (1 << col_idx)):
                record[col_name] = previous_values.get(col_name)
            # Priority 3: Use new value from C array
            else:
                if c_idx < len(c_values):
                    value = c_values[c_idx]
                    record[col_name] = value
                    previous_values[col_name] = value
                    c_idx += 1
                else:
                    record[col_name] = None

        records.append(record)

    return records


def request_facilities(key: str, body: dict[str, Any]) -> dict[str, Any]:
    res = requests.post(
        f"{POWERBI_BASE_URL}/querydata",
        headers={"X-PowerBI-ResourceKey": key},
        json=body,
    )
    return res.json()


def get_resource_key() -> str:
    resource_key = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        def on_request(request):
            nonlocal resource_key
            headers = request.headers
            if "x-powerbi-resourcekey" in headers:
                resource_key = headers["x-powerbi-resourcekey"]

        page.on("request", on_request)

        page.goto("https://www.michigan.gov/opioids/find-help/misud-locator")
        page.wait_for_timeout(5000)  # let visuals load

        browser.close()
    return resource_key


if __name__ == "__main__":
    with Path.open(BASE_DIR / "request.json", "r") as f:
        request_body = json.load(f)

    key = get_resource_key()
    data = request_facilities(key, request_body)

    parsed_rows = parse_powerbi_dm0(
        data["results"][1]["result"]["data"]["dsr"]["DS"][0]["PH"][0]["DM0"]
    )

    coordinates_map = load_coordinates()

    facilities = [
        {**asdict(clean_facility(row, coordinates_map)), "state": "MI"}
        for row in parsed_rows
    ]
    with Path.open(BASE_DIR.parent / "src" / "assets" / "facilities.json", "w") as f:
        json.dump(facilities, f)
