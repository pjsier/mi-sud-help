export const fromEntries = (entries) =>
  entries.reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})

export const objectFromSearchParams = (params) => {
  const obj = {}
  params.forEach((val, key) => {
    obj[key] = val
  })
  return obj
}

export function updateQueryParams(params) {
  // Retain query params not included in the params we're updating
  const initParams = fromEntries(
    Object.entries(
      objectFromSearchParams(new URLSearchParams(window.location.search))
    ).filter((vals) => !Object.keys(params).includes(vals[0]))
  )
  // TODO: If boolean filters may need to be more careful here
  const cleanParams = fromEntries(
    Object.entries(params).filter(([key, value]) => {
      if (key === "page") {
        return value > 1
      } else if (Array.isArray(value)) {
        return value.length > 0
      } else {
        return !!value
      }
    })
  )
  // Merge the existing, unwatched params with the filter params
  const updatedParams = new URLSearchParams({
    ...initParams,
    ...cleanParams,
  })
  const suffix = updatedParams.toString() === `` ? `` : `?${updatedParams}`
  window.history.replaceState(
    {},
    window.document.title,
    `${window.location.protocol}//${window.location.host}${window.location.pathname}${suffix}`
  )
}

// Based on https://gist.github.com/SimonJThompson/c9d01f0feeb95b18c7b0
function toRad(v) {
  return (v * Math.PI) / 180
}

function kmToMiles(km) {
  return (km * 0.62137).toFixed(2)
}

export function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371 // km
  const x1 = lat2 - lat1
  const dLat = toRad(x1)
  const x2 = lon2 - lon1
  const dLon = toRad(x2)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c
  return +kmToMiles(d)
}
