# Pathcal

Export a registered Path@Penn schedule to an `.ics` calendar file.

## Website

The new bookmarklet-based exporter lives at [pathcal.intelchen.com](https://pathcal.intelchen.com). Drag the **Export Path@Penn** button to your bookmarks bar, open the Primary Cart calendar in Path@Penn, and click the bookmark.

The website source is in [`web/`](web/). The original console script remains available below for existing users.

Pathcal builds schedules locally in the browser. On download, it sends parser-health metadata, the detected term, and aggregate course/meeting counts to PostHog. A student may optionally include their name and email. A default-selected control also shares redacted Path@Penn calendar-label formats: Pathcal removes the course and section identity and replaces numeric values before sending them as a separate anonymous event. Students can uncheck this control to send aggregate health only. The page, Penn account data, and generated calendar file are never transmitted.

## Development

```bash
cd web
npm install
npm run dev
```

`npm run build` refreshes the checked-in semester rules from the official Penn Almanac calendar, embeds them in the bookmarklet, and builds the static site for Netlify.

## Motivation

Path at Penn sucks no doubt. One important feature of pennintouch was the ability to export ics file for calendars. I decided to fix this by creating a javascript script that downloads the ics file for a given path at penn calendar.
## Video Tutorial
![Calendar export for Path @ Penn - Watch Video](https://cdn.loom.com/sessions/thumbnails/69b23257cc324d7bb49c0ffb580dcea2-with-play.gif "Calendar export for Path @ Penn")

[Calendar export for Path @ Penn - Watch Video](https://www.loom.com/share/69b23257cc324d7bb49c0ffb580dcea2)


## Legacy console installation
1. Open Path at Penn -> Primary Cart -> "Calendar" Logo
2. Open console (F12 or right click -> inspect element-> choose console tab) (For **Safari**, open Preference-> Advanced -> Show Develop menu in menu bar and then right click -> Inspect Element)
3. click inside the console and paste the script in this repo *script.js*
4. "Enter” on the keyboard to run the script
5. ta-da! Take the .ics file and import it into your calendar.

## Contact
Pathcal is a project by [Intel Chen](https://www.instagram.com/intel.build.stuff/). For feedback or questions, please contact me at yihechen@seas.upenn.edu.
