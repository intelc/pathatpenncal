//https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server


//////////////////////
//PLEASE UPDATE THE BELOW PARAMETERS

let CURRENT_SEMESTER_END = `1208`  //MMDD
let CURRENT_SEMESTER_BEGINING_MONDAY = `0826`

//Following optional content helps me know who have used this script-- thank you！
let YOUR_NAME = `john doe`
let YOUR_EMAIL= ``

//////////////////////
//////////////////////



function generateWeekDates(mondayDateString) {
  // Parse year, month, and day from the provided string
  const year = parseInt(mondayDateString.substring(0, 4), 10);
  const month = parseInt(mondayDateString.substring(4, 6), 10) - 1; // months are 0-indexed in JS
  const day = parseInt(mondayDateString.substring(6, 8), 10);

  // Create a new date object for the provided Monday
  const date = new Date(year, month, day);

  const weekDates = [];

  // Loop for Tuesday through Friday (1 through 4 days from Monday)
  for (let i = 1; i <= 4; i++) {
    // Increment day by 1
    date.setDate(date.getDate() + 1);

    // Format date to 'yyyymmdd'
    const formattedDate = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    weekDates.push(formattedDate);
  }

  return weekDates;
}
//if the current month is november - march, set the starting year to next year
let current_or_next_year = new Date().getMonth() > 9 ? new Date().getFullYear() + 1 : new Date().getFullYear()

let first_week = generateWeekDates(current_or_next_year + CURRENT_SEMESTER_BEGINING_MONDAY)

function download(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}
//https://ical.marudot.com/
let prefix =
  `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//intelchen.com//Intel Chen
CALSCALE:GREGORIAN
BEGIN:VTIMEZONE
TZID:America/Havana
LAST-MODIFIED:20201011T015911Z
TZURL:http://tzurl.org/zoneinfo-outlook/America/Havana
X-LIC-LOCATION:America/Havana
BEGIN:STANDARD
TZNAME:CST
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
DTSTART:19701101T010000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
BEGIN:DAYLIGHT
TZNAME:CDT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
DTSTART:19700308T000000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
END:VTIMEZONE\n`

let suffix = 'END:VCALENDAR'

//https://bobbyhadz.com/blog/javascript-get-current-date-and-time-in-utc
let isoStr = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replaceAll(".", "")
let currentUTC = isoStr.slice(0, isoStr.length - 4) + "Z"





//https://github.com/30-seconds/30-seconds-of-code/blob/master/snippets/UUIDGeneratorBrowser.md
const UUIDGeneratorBrowser = () =>
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );

// convert Path @ Penn time format to UTC (substring) format that we can use  
function timeConversion(input) {
  let clean_input = input.replaceAll(",", "").replaceAll(".", "")

  if (String(clean_input).includes("pm")) {
    clean_input_list = clean_input.replaceAll("pm", "").split(":")

    clean_input = String(Number(clean_input_list[0]) + 12) + clean_input_list[1]
  }
  else {
    clean_input_list = clean_input.replaceAll("am", "").split(":")
    if (Number(clean_input_list[0]) < 10) {
      clean_input = String("0" + clean_input_list[0] + clean_input_list[1])
    }
    else {
      clean_input = String(clean_input_list[0] + clean_input_list[1])
    }


  }
  return clean_input
}
///////////////

// initial date designation. Here we are sacrificing the monday(even tho we start tuesday, I didn't make)
// that into a special case to reduce complexity

function getInitDate(input) {
  if (input == "Tuesday") {
    return first_week[0]
  }
  else if (input == "Monday") {
    return CURRENT_SEMESTER_BEGINING_MONDAY
  }
  else if (input == "Friday") {
    return first_week[3]
  }
  else if (input == "Wednesday") {
    return first_week[1]
  }
  else if (input == "Thursday") {
    return first_week[2]
  }
}
//Scrape data from the Path @ Penn page
let a = document.querySelectorAll("body > main > div.panel.panel--2x.panel--kind-calendar.panel--visible > div > div.panel__body > div.section > div > svg > g > g.section")
let b = Array.from(a)
let c = b.map((item) => item.getAttribute('aria-label'));
let unique_courses = [...new Set(c)];

unique_courses = unique_courses.filter(course => course.includes("Registered"))
//setting up the file content
var cal_str = prefix
let event_str = ""


//iterate through each "event" and set up recurrence 
for (let i = 0; i < unique_courses.length; i++) {
  let course_string = unique_courses[i]
  let course_name = course_string.split(' - ')[0]
  let couse_schedule_string = course_string.split(' - ')[1].split(' ')

  console.log(course_string)

  if (course_string.includes("and")) {
    //Case where there is a two-day recurrence
    event_str =
      `BEGIN:VEVENT
DTSTAMP:${currentUTC}
UID:${UUIDGeneratorBrowser()}
DTSTART;TZID=America/Havana:${current_or_next_year}${getInitDate(couse_schedule_string[0])}T${timeConversion(couse_schedule_string[2])}00
RRULE:FREQ=WEEKLY;BYDAY=${couse_schedule_string[0].slice(0, 2).toUpperCase()},${couse_schedule_string[6].slice(0, 2).toUpperCase()};UNTIL=${current_or_next_year}${CURRENT_SEMESTER_END}T170000Z
DTEND;TZID=America/Havana:${current_or_next_year}${getInitDate(couse_schedule_string[0])}T${timeConversion(couse_schedule_string[4])}00
SUMMARY:${course_name}
END:VEVENT\n`
  }
  else {
    //Case where there is a one-day recurrence
    event_str =
      `BEGIN:VEVENT
DTSTAMP:${currentUTC}
UID:${UUIDGeneratorBrowser()}
DTSTART;TZID=America/Havana:${current_or_next_year}${getInitDate(couse_schedule_string[0])}T${timeConversion(couse_schedule_string[2])}00
RRULE:FREQ=WEEKLY;BYDAY=${couse_schedule_string[0].slice(0, 2).toUpperCase()};UNTIL=${current_or_next_year}${CURRENT_SEMESTER_END}T170000Z
DTEND;TZID=America/Havana:${current_or_next_year}${getInitDate(couse_schedule_string[0])}T${timeConversion(couse_schedule_string[4])}00
SUMMARY:${course_name}
END:VEVENT\n`
  }


  cal_str = cal_str + event_str
}
// Define the URL
const url = 'https://app.posthog.com/capture/';

// Define the request payload
const payload = {
  api_key: 'phc_uo5R9K8TzXAeF3WmOUqsKJ2cxdR8N0x14BylN5xeLOl', // Your API key
  event: 'calendar download', // Replace with your event name
  properties: {
    distinct_id: document.querySelector('body > header > div > div > span.user-name').innerText, // Replace with the distinct ID of your user
    classes:unique_courses,
    optional_name: YOUR_NAME,
    optional_email: YOUR_EMAIL,
  },
  timestamp: new Date().toISOString() // Replace with your timestamp, if needed
};

// Make the POST request
fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch((error) => console.error('Error:', error));
cal_str = cal_str + suffix

// Start file download.
download("course_calendar.ics",
  cal_str);
