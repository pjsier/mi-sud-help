import {
  createEffect,
  createMemo,
  createSignal,
  onMount,
  onCleanup,
  For,
  Show,
} from "solid-js"
import { createStore } from "solid-js/store"
import { createIntersectionObserver } from "@solid-primitives/intersection-observer"
import { updateQueryParams, haversine } from "../utils"
import Result from "./result"
import UpArrowIcon from "./icons/up-arrow-icon"

const PAGE_SIZE = 5

const SEARCH_MILES = 15

const SERVICES = [
  "Inpatient",
  "Med Assist Treatment",
  "Outpatient",
  "Prevention",
  "Res. With. Mgmt",
  "Residential",
  "Screen & Assess",
  "SUD Counseling",
]

const DEBOUNCE_TIME = 350

/* eslint-disable */
// Debounce function from underscore
export const debounce = (func, wait, immediate) => {
  let timeout
  return function () {
    const context = this
    const args = arguments
    const later = () => {
      timeout = null
      if (!immediate) func.apply(context, args)
    }
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    if (callNow) func.apply(context, args)
  }
}
/* eslint-enable */

function stateFromParams(params) {
  return {
    search: params.get("search"),
    services:
      (params.get("services") || "").split(",").filter((svc) => !!svc) || [],
    page: +params.get("page") || 1,
    acceptsMedicaid: params.get("acceptsMedicaid") === "true",
  }
}

function filterResults(data, zip, coordinates, services, acceptsMedicaid) {
  return data.filter((result) => {
    if (
      services?.length > 0 &&
      !services.some((service) => result.services.includes(service))
    ) {
      return false
    } else if (acceptsMedicaid && !result.accepts_medicaid) {
      return false
    } else if (zip && !result.zipcode.startsWith(zip)) {
      return false
    } else if (
      coordinates &&
      haversine(coordinates, result.coordinates) > SEARCH_MILES
    ) {
      return false
    }
    return true
  })
}

function filtersHaveValues(filters) {
  return !!Object.entries(filters).find(([key, value]) =>
    key === `page` ? value > 1 : !!value
  )
}

const FilterComponent = (props) => {
  const [state, setState] = createStore({
    zip: ``,
    address: ``,
    coordinates: null,
    services: [],
    acceptsMedicaid: false,
    page: 1,
    showScrollTop: false,
    isPrinting: false,
  })

  const results = createMemo(() =>
    filterResults(
      props.data,
      state.zip,
      state.coordinates,
      state.services,
      state.acceptsMedicaid
    )
  )

  const [targets, setTargets] = createSignal([])

  onMount(() => {
    const params = new URLSearchParams(window.location.search)
    setState(stateFromParams(params))

    const media = window.matchMedia("print")

    const mediaChangeHandler = (e) => {
      setState({ isPrinting: e.matches })
    }

    media.addEventListener("change", mediaChangeHandler)

    onCleanup(() => media.removeEventListener("change", mediaChangeHandler))
  })

  createIntersectionObserver(targets, (entries) => {
    // const resultsEnd = entries.find(({ target }) => target.id === "results-end")
    const filterForm = entries.find(({ target }) =>
      target.classList.contains("filter-form")
    )
    // if (resultsEnd?.isIntersecting) {
    //   setState({ page: state.page + 1 })
    // }
    if (filterForm) {
      setState({ showScrollTop: !filterForm?.isIntersecting })
    }
  })

  createEffect(() => {
    updateQueryParams({
      zip: state.zip,
      address: state.address,
      coordinates: state.coordinates,
      search: state.search,
      services: state.services,
      acceptsMedicaid: state.acceptsMedicaid,
      page: state.page,
    })
  })

  // TODO: Should probably use this
  // Helper to make sure the page resets whenever filters change
  const setFilters = (filters) => setState({ ...filters, page: 1 })

  const debouncedSetFilters = debounce(setFilters, DEBOUNCE_TIME)

  return (
    <>
      <Show when={state.showScrollTop}>
        <button
          aria-label="Scroll to top"
          id="scroll-to-top"
          onClick={() => window.scroll({ top: 0, left: 0, behavior: "smooth" })}
        >
          <UpArrowIcon />
        </button>
      </Show>
      <form
        class="filter-form"
        action=""
        method="GET"
        ref={(el) => setTargets((e) => [...e, el])}
      >
        <div>
          <label for="zip">ZIP Code</label>
          <input
            id="zip"
            name="zip"
            value={state.zip}
            onInput={(e) => debouncedSetFilters({ zip: e.target.value })}
          />
        </div>
        {/* TODO: Geocoder input for address search */}
        <div>
          <label for="accepts_medicaid">
            <span>Accepts Medicaid?</span>
            <input
              type="checkbox"
              name="accepts_medicaid"
              id="accepts_medicaid"
              value={state.acceptsMedicaid}
              onChange={(e) =>
                setState({ acceptsMedicaid: e.target.checked || null })
              }
            />
          </label>
        </div>
        <fieldset>
          <legend>Services</legend>
          {SERVICES.map((service, idx) => (
            <label for={`service_${idx}`}>
              <input
                type="checkbox"
                id={`service_${idx}`}
                name={`service_${idx}`}
                checked={state.services.includes(service)}
                onChange={(e) => {
                  setState({
                    services: [
                      ...state.services.filter((svc) => svc !== service),
                      ...(e.target.checked ? [service] : []),
                    ],
                  })
                }}
              />
              <span>{service}</span>
            </label>
          ))}
        </fieldset>
        <div class="results-row">
          <p aria-live="polite" aria-atomic="true" class="result-count">
            {`${results().length.toLocaleString()} ${
              results().length === 1 ? `result` : `results`
            }`}
          </p>
          {filtersHaveValues(state) && (
            <button
              type="button"
              onClick={() =>
                setState({
                  zip: ``,
                  address: ``,
                  coordinates: null,
                  services: [],
                  acceptsMedicaid: false,
                  page: 1,
                })
              }
            >
              Clear filters
            </button>
          )}
        </div>
      </form>
      <div class="filter-results">
        <For
          each={results().slice(
            0,
            state.isPrinting ? results().length : PAGE_SIZE * state.page
          )}
        >
          {({
            name,
            services,
            lara_id,
            website,
            phone,
            address,
            city,
            zipcode,
            accepts_medicaid,
          }) => (
            <Result
              name={name}
              services={services}
              lara_id={lara_id}
              website={website}
              phone={phone}
              address={address}
              city={city}
              zipcode={zipcode}
              acceptsMedicaid={accepts_medicaid}
            />
          )}
        </For>
      </div>
      <Show when={state.page < Math.ceil(results().length / PAGE_SIZE)}>
        <button
          ref={(el) => setTargets((e) => [...e, el])}
          type="button"
          id="results-end"
          class="visually-hidden"
          onClick={() => {
            // TODO: Check this on load, when clicking back intersection observer
            // won't fire because not changed
            setState({ page: state.page + 1 })
            // Imperfect, seems to skip from jumping around, but moves focus forward
            document
              .querySelector(
                `.filter-results .filter-result:nth-child(${
                  state.page * PAGE_SIZE
                }) a`
              )
              .focus()
          }}
        >
          Show more
        </button>
      </Show>
    </>
  )
}

export default FilterComponent
