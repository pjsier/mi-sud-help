import LinkIcon from "./icons/link-icon"
import PhoneIcon from "./icons/phone-icon"

const Result = (props) => {
  const cleanPhone = props.phone.startsWith("1")
    ? `+${props.phone}`
    : `+1${props.phone}`
  return (
    <div class="filter-result">
      {/* TODO: Add external link icon next to it if valid */}
      <p>
        {props.website ? (
          <a href={props.website}>
            {props.name}&nbsp;
            <LinkIcon />
          </a>
        ) : (
          props.name
        )}
      </p>
      <p>{props.services.join(", ")}</p>
      <p>
        {props.address} {props.city} {props.zipcode}
      </p>
      <p>
        <a href={`tel:${cleanPhone}`}>
          <PhoneIcon /> {props.phone}
        </a>
      </p>
      <p>
        <span>Accepts Medicaid: </span>
        <span>{props.acceptsMedicaid ? "Yes" : "No"}</span>
      </p>
    </div>
  )
}

export default Result
