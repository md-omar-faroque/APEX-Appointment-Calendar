(function (global) {
    "use strict";

    var instances = Object.create(null);

    function pad2(value) {
        return String(value).padStart(2, "0");
    }

    function toIsoLocal(date) {
        return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
    }

    function parseIsoLocal(value) {
        var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
        if (!match) return null;
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    function parsePageDate(value, format) {
        if (!value) return null;
        format = format || "DD/MM/YYYY";
        var parts;
        if (format === "DD/MM/YYYY") {
            parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value).trim());
            if (!parts) return null;
            return validDate(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
        }
        if (format === "YYYY-MM-DD") {
            return parseIsoLocal(String(value).trim());
        }
        throw new Error("Unsupported dateFormat: " + format);
    }

    function validDate(year, month, day) {
        var date = new Date(year, month, day);
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
        return date;
    }

    function formatPageDate(date, format) {
        format = format || "DD/MM/YYYY";
        var dd = pad2(date.getDate());
        var mm = pad2(date.getMonth() + 1);
        var yyyy = date.getFullYear();
        if (format === "DD/MM/YYYY") return dd + "/" + mm + "/" + yyyy;
        if (format === "YYYY-MM-DD") return yyyy + "-" + mm + "-" + dd;
        throw new Error("Unsupported dateFormat: " + format);
    }

    function startOfToday(now) {
        now = now || new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function isBeforeToday(date, now) {
        return date.getTime() < startOfToday(now).getTime();
    }

    function getApexItem(itemName) {
        if (!itemName || !global.apex || !global.apex.item) return null;
        return global.apex.item(itemName);
    }

    function readItem(itemName) {
        var item = getApexItem(itemName);
        return item ? item.getValue() : "";
    }

    function writeItem(itemName, value) {
        var item = getApexItem(itemName);
        if (item) item.setValue(value, null, true);
    }

    function configure(options, config) {
        config = config || {};
        var regionId = config.regionId || "CAL_EVENTS";
        var dateItem = config.dateItem || "P1024050_APPOINT_DATE";
        var dateFormat = config.dateFormat || "DD/MM/YYYY";
        var syncPageItems = config.syncPageItems || [];
        var minDate = config.minDate === false ? null : startOfToday();
        var originalDatesSet = options.datesSet;
        var originalDateClick = options.dateClick;
        var originalDayCellClassNames = options.dayCellClassNames;
        var originalViewDidMount = options.viewDidMount;

        function selectedDate() {
            return parsePageDate(readItem(dateItem), dateFormat);
        }

        function setSelectedDate(date) {
            var value = formatPageDate(date, dateFormat);
            writeItem(dateItem, value);
            syncPageItems.forEach(function (name) {
                writeItem(name, value);
            });
        }

        function calendarApi() {
            return instances[regionId] || null;
        }

        options.validRange = Object.assign({}, options.validRange || {});
        if (minDate) options.validRange.start = toIsoLocal(minDate);

        options.datesSet = function (info) {
            instances[regionId] = info.view.calendar;
            if (typeof originalDatesSet === "function") originalDatesSet.apply(this, arguments);
            applySelectedClass();
        };

        options.dayCellClassNames = function (arg) {
            var classes = [];
            if (isBeforeToday(arg.date)) classes.push("apex-cal-past-date");
            var selected = selectedDate();
            if (selected && toIsoLocal(selected) === toIsoLocal(arg.date)) {
                classes.push("apex-cal-selected-date");
            }
            if (typeof originalDayCellClassNames === "function") {
                var original = originalDayCellClassNames.apply(this, arguments);
                if (Array.isArray(original)) classes = classes.concat(original);
            }
            return classes;
        };

        options.dateClick = function (info) {
            var clicked = parseIsoLocal(info.dateStr.slice(0, 10));
            if (!clicked || isBeforeToday(clicked)) {
                if (global.apex && global.apex.message) {
                    global.apex.message.alert("Cannot select a past date. Please select today or a future date.");
                }
                return;
            }
            setSelectedDate(clicked);
            applySelectedClass();
            if (typeof config.onDateSelected === "function") config.onDateSelected(clicked, info);
            if (typeof originalDateClick === "function") originalDateClick.apply(this, arguments);
            if (typeof config.focusAfterSelect === "function") config.focusAfterSelect(clicked, info);
        };

        options.customButtons = Object.assign({}, options.customButtons || {}, {
            myToday: {
                text: config.todayButtonText || "Today",
                click: function () {
                    var today = startOfToday();
                    var api = calendarApi();
                    if (api) api.gotoDate(today);
                    setSelectedDate(today);
                    applySelectedClass();
                    if (typeof config.onDateSelected === "function") config.onDateSelected(today, { source: "today-button" });
                }
            }
        });

        options.headerToolbar = config.toolbar || options.headerToolbar || {
            left: "prev,next myToday",
            center: "title",
            right: "dayGridMonth"
        };

        function applySelectedClass() {
            var api = calendarApi();
            if (api && typeof api.render === "function") api.render();
        }

        // Public methods used by APEX Dynamic Actions and custom buttons.
        var publicApi = {
            gotoDate: function (date) {
                var parsed = date instanceof Date ? date : parseIsoLocal(date);
                if (!parsed) throw new Error("gotoDate expects a Date or YYYY-MM-DD string.");
                if (isBeforeToday(parsed)) {
                    if (global.apex && global.apex.message) {
                        global.apex.message.alert("Cannot navigate to a past appointment date.");
                    }
                    return false;
                }
                var api = calendarApi();
                if (api) api.gotoDate(parsed);
                setSelectedDate(parsed);
                applySelectedClass();
                return true;
            },
            moveDays: function (days) {
                var api = calendarApi();
                if (!api) return false;
                var target = new Date(api.getDate());
                target.setDate(target.getDate() + Number(days || 0));
                return publicApi.gotoDate(target);
            },
            moveMonths: function (months) {
                var api = calendarApi();
                if (!api) return false;
                var target = new Date(api.getDate());
                target.setDate(1);
                target.setMonth(target.getMonth() + Number(months || 0));
                if (isBeforeToday(target)) target = startOfToday();
                var moved = publicApi.gotoDate(target);
                if (moved) api.changeView("dayGridMonth");
                return moved;
            },
            syncFromPageItem: function () {
                var date = selectedDate();
                if (!date || isBeforeToday(date)) return false;
                var api = calendarApi();
                if (api) api.gotoDate(date);
                applySelectedClass();
                return true;
            },
            selectToday: function () {
                var today = startOfToday();
                var api = calendarApi();
                if (api) api.gotoDate(today);
                setSelectedDate(today);
                applySelectedClass();
                return true;
            },
            refreshMinDate: function () {
                if (minDate) {
                    options.validRange.start = toIsoLocal(startOfToday());
                    var api = calendarApi();
                    if (api) api.setOption("validRange", options.validRange);
                }
            },
            getSelectedDate: selectedDate
        };

        instances[regionId] = null;
        instances[regionId + ":pending"] = publicApi;

        // Keep the original view hook if supplied by the region plug-in.
        options.viewDidMount = function () {
            if (typeof originalViewDidMount === "function") originalViewDidMount.apply(this, arguments);
        };

        return options;
    }

    function get(regionId) {
        var id = regionId || "CAL_EVENTS";
        return instances[id + ":pending"] || instances[id] || null;
    }

    global.ApexAppointmentCalendar = {
        configure: configure,
        get: get,
        utils: {
            parseIsoLocal: parseIsoLocal,
            parsePageDate: parsePageDate,
            formatPageDate: formatPageDate,
            isBeforeToday: isBeforeToday,
            toIsoLocal: toIsoLocal
        }
    };
}(window));
