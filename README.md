# Oracle APEX Appointment Calendar

A reusable calendar navigation module based on the **Eye Appointment** page export supplied for this project (Oracle APEX 24.2, page 1024050).

The repository isolates the calendar behavior from the larger Medicare application. It does **not** include patient, doctor, fee, schedule, or appointment database logic.

## Features

- Past dates cannot be selected (calendar cells are disabled and clicks are guarded).
- Today and future dates remain selectable.
- Selecting a date writes the configured APEX page item in `DD/MM/YYYY` format.
- The selected date is highlighted after initial render, date selection, navigation, and calendar refresh.
- A **Today** toolbar button moves the calendar to today and writes today to the page item.
- Previous / next month navigation is available.
- Page-item changes can drive the calendar position.
- Custom navigation API supports jumping to a date or moving by days / months.
- Optional focus behavior after selecting a date.
- No dependency on jQuery for the calendar module itself; it uses the APEX item API when running in APEX.

## Source-page findings

The supplied export identifies:
- Application 104, page 1024050, page name `Eye Appointment`.
- Calendar region name `CAL_EVENTS`, region title `Calender`, using `NATIVE_CSS_CALENDAR`.
- Calendar date column `APPOINT_DATE`, display column `TOTAL_APPOINTMENT`, and event color column `EVENT_COLOR`.
- Existing calendar JavaScript uses FullCalendar callbacks `datesSet` and `dateClick`, a custom `myToday` button, and a toolbar with `prev,next myToday`.
- The calendar submits `P1024050_DOCTOR_NO`, `P1024050_SHIFT`, `P1024050_SHIFTDTL_NO`, `P1024050_BU_NO`, and `P1024050_APPOINT_DT`.
- Existing date selection writes `P1024050_APPOINT_DATE`; another page function highlights from `P1024050_APPOINT_DT`. This is a page-item mismatch worth resolving in the APEX page.
- The patient list query filters by `:P1024050_APPOINT_DATE`.

The new module uses **one canonical selected-date item** by default: `P1024050_APPOINT_DATE`. If other page processes depend on `P1024050_APPOINT_DT`, configure `syncPageItems` to keep both items aligned.

## Quick start

1. Copy `src/apex-appointment-calendar.js` and `src/apex-appointment-calendar.css` into the APEX application Static Application Files, or reference them from your web server.
2. In **Page 1024050 → JavaScript → File URLs**, add:

   ```text
   #APP_FILES#apex-appointment-calendar.js
   ```

3. In **Page 1024050 → CSS → File URLs**, add:

   ```text
   #APP_FILES#apex-appointment-calendar.css
   ```

4. In the `CAL_EVENTS` calendar region's **JavaScript Initialization Code**, use:

   ```javascript
   function (options) {
       return ApexAppointmentCalendar.configure(options, {
           dateItem: "P1024050_APPOINT_DATE",
           syncPageItems: ["P1024050_APPOINT_DT"],
           minDate: "today",
           toolbar: {
               left: "prev,next myToday",
               center: "title",
               right: "dayGridMonth"
           },
           focusAfterSelect: function () {
               var hn = apex.item("P1024050_HN").getValue();
               var regNo = apex.item("P1024050_REG_NO").getValue();

               if (!hn && !regNo) {
                   $("#P1024050_FNAME").trigger("focus");
               } else if (regNo) {
                   $("#P1024050_BU_NO").trigger("focus");
               }
           }
       });
   }
   ```

   If `P1024050_APPOINT_DT` is not used by any other component, remove it from `syncPageItems`.

5. Ensure `P1024050_APPOINT_DATE` is included in the calendar region's **Page Items to Submit** / relevant AJAX refresh dependencies. Keep the existing business page items required by the source query.
6. Set the calendar region date column to `APPOINT_DATE`. Keep the event/display columns required by your SQL query.
7. Test the behavior with a test user and non-production data before deploying.

## Page-item contract

| Item | Purpose |
|---|---|
| `P1024050_APPOINT_DATE` | Canonical selected appointment date, `DD/MM/YYYY` |
| `P1024050_APPOINT_DT` | Optional legacy date item; synchronize only if other page logic needs it |
| `P1024050_CALENDAR_NAV_DATE` | Optional separate item if you want to store the currently visible calendar date |

The module intentionally does not assume that the calendar's visible month and selected appointment date are the same thing.

## Custom navigation

The module exposes `window.ApexAppointmentCalendar.get("CAL_EVENTS")` after the calendar has initialized.

```javascript
var calendar = ApexAppointmentCalendar.get("CAL_EVENTS");

// Jump to a date (Date object or YYYY-MM-DD string).
calendar.gotoDate("2026-12-15");

// Move the visible calendar by a number of days or months.
calendar.moveDays(7);
calendar.moveMonths(1);

// Re-read the selected date from the APEX page item and navigate to it.
calendar.syncFromPageItem();

// Select today, navigate to it, and write it to the page item.
calendar.selectToday();
```

You can connect an APEX button or Dynamic Action to these methods. Example Dynamic Action JavaScript:

```javascript
ApexAppointmentCalendar.get("CAL_EVENTS").moveDays(1);
```

To make a page item drive navigation, create a Dynamic Action on change of that item and execute:

```javascript
ApexAppointmentCalendar.get("CAL_EVENTS").syncFromPageItem();
```

## Date handling and validation

- The client uses local calendar dates (not UTC date parsing) to avoid timezone shifts.
- The date item format is `DD/MM/YYYY` by default; change `dateFormat` only if your APEX item uses another format.
- The browser blocks past dates for usability. **This is not a security or business-rule boundary.** Add server-side validation to every process that creates or changes an appointment, for example reject `TRUNC(:P_APPOINT_DATE) < TRUNC(SYSDATE)`.
- If a user leaves the page open across midnight, call `refreshMinDate()` or refresh the page so the minimum date advances to the new today.

## Demo

Open `demo/index.html` in a browser. The demo uses FullCalendar from a public CDN and demonstrates past-date blocking, selected-date highlighting, Today, previous/next navigation, page-item simulation, and custom day/month navigation.

## Tests

Run the lightweight Node tests:

```bash
node --test tests/calendar-utils.test.js
```

## Compatibility notes

- The supplied export is APEX 24.2 and uses the native APEX CSS Calendar plug-in's FullCalendar-based initialization options.
- This module is designed to be called from that region's **JavaScript Initialization Code**. Verify callback support against the exact calendar plug-in version installed in your APEX environment.
- The SQL export contains application-specific tables, functions, page items, and security context. Those are intentionally not reproduced as a standalone runnable schema here.
- The repository does not claim to have been executed against the user's database or APEX instance.
