//https://stackoverflow.com/questions/3665115/how-to-create-a-file-in-memory-for-user-to-download-but-not-through-server
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
let isoStr = new Date().toISOString().replaceAll("-","").replaceAll(":","").replaceAll(".","")
let currentUTC = isoStr.slice(0, isoStr.length - 4)+"Z"

//https://github.com/30-seconds/30-seconds-of-code/blob/master/snippets/UUIDGeneratorBrowser.md
const UUIDGeneratorBrowser = () =>
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );

// convert Path @ Penn time format to UTC (substring) format that we can use  
function timeConversion(input){
    let clean_input = input.replaceAll(",","").replaceAll(".","")
    
    if(String(clean_input).includes("pm")){
        clean_input_list = clean_input.replaceAll("pm","").split(":")
      
        clean_input = String(Number(clean_input_list[0])+12)+clean_input_list[1]
    }
    else{
        clean_input_list = clean_input.replaceAll("am","").split(":")
        if (Number(clean_input_list[0])<10){
          clean_input = String("0"+clean_input_list[0]+clean_input_list[1])
        }
        else{
          clean_input = String(clean_input_list[0]+clean_input_list[1])
        }
        
        
    }
    return clean_input
}
///////////////

// initial date designation. Here we are sacrificing the monday(even tho we start tuesday, I didn't make)
// that into a special case to reduce complexity
function getInitDate(input){
  if(input == "Tuesday"){
    return "0110"
  }
  else if(input == "Monday"){
    return "0109"
  }
  else if(input == "Friday"){
    return "0113"
  }
  else if(input == "Wednesday"){
    return "0111"
  }
  else if(input == "Thursday"){
    return "0112"
  }
}
//Scrape data from the Path @ Penn page
let a = document.querySelectorAll("body > main > div.panel.panel--2x.panel--kind-calendar.panel--visible > div > div.panel__body > div.section > div > svg > g > g.section")
let b = Array.from(a)
let c = b.map((item) => item.getAttribute('aria-label'));
let unique_courses = [...new Set(c)];

//setting up the file content
var cal_str = prefix
let event_str = ""

//iterate through each "event" and set up recurrence 
for (let i = 0; i < unique_courses.length; i++) {
  let course_string = unique_courses[i]
  let course_name = course_string.split(' - ')[0]
  let couse_schedule_string = course_string.split(' - ')[1].split(' ')

  
  if(course_string.includes("and")){
  //Case where there is a two-day recurrence
    event_str = 
`BEGIN:VEVENT
DTSTAMP:${currentUTC}
UID:${UUIDGeneratorBrowser()}
DTSTART;TZID=America/Havana:2023${getInitDate(couse_schedule_string[0])}T${timeConversion(couse_schedule_string[2])}00
RRULE:FREQ=WEEKLY;BYDAY=${couse_schedule_string[0].slice(0,2).toUpperCase()},${couse_schedule_string[6].slice(0,2).toUpperCase()};UNTIL=20230426T170000Z
DTEND;TZID=America/Havana:2023${getInitDate(couse_schedule_string[0])}T${timeConversion(couse_schedule_string[4])}00
SUMMARY:${course_name}
END:VEVENT\n`
  }
  else{
    //Case where there is a one-day recurrence
    event_str = 
`BEGIN:VEVENT
DTSTAMP:${currentUTC}
UID:${UUIDGeneratorBrowser()}
DTSTART;TZID=America/Havana:2023${getInitDate(couse_schedule_string[0])}T${timeConversion(couse_schedule_string[2])}00
RRULE:FREQ=WEEKLY;BYDAY=${couse_schedule_string[0].slice(0,2).toUpperCase()};UNTIL=20230426T170000Z
DTEND;TZID=America/Havana:2023${getInitDate(couse_schedule_string[0])}T${timeConversion(couse_schedule_string[4])}00
SUMMARY:${course_name}
END:VEVENT\n`
  }
  

  cal_str = cal_str + event_str 
}

//Finish the content with some suffix
cal_str = cal_str+suffix


  // Start file download.
  download("course_calendar.ics",
  cal_str);
  
