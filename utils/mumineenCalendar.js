const moment = require('moment-timezone');

/**
 * Mumineen (Fatimid / Misri / Dawoodi Bohra) Hijri Calendar Module
 * Based on tabular Hijri calendar math from mumineen_calendar_js repository
 */

// Hijri year remainders for determining Kabisa (leap) years in 30-year cycle
const KABISA_YEAR_REMAINDERS = [2, 5, 8, 10, 13, 16, 19, 21, 24, 27, 29];

// Cumulative days in a Hijri year by month end (0-indexed through month 10)
const DAYS_IN_YEAR = [30, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325];

// Cumulative days in a 30-year cycle for each Hijri year
const DAYS_IN_30_YEARS = [
   354,  708, 1063, 1417, 1771, 2126, 2480, 2834,  3189,  3543,
  3898, 4252, 4606, 4961, 5315, 5669, 6024, 6378,  6732,  7087,
  7441, 7796, 8150, 8504, 8859, 9213, 9567, 9922, 10276, 10631
];

// Month names (traditional long & short Mumineen names)
const MONTH_NAMES = {
  long: [
    "Moharram al-Haraam",
    "Safar al-Muzaffar",
    "Rabi al-Awwal",
    "Rabi al-Aakhar",
    "Jumada al-Ula",
    "Jumada al-Ukhra",
    "Rajab al-Asab",
    "Shabaan al-Karim",
    "Ramadaan al-Moazzam",
    "Shawwal al-Mukarram",
    "Zilqadah al-Haraam",
    "Zilhaj al-Haraam"
  ],
  short: [
    "Moharram",
    "Safar",
    "Rabi I",
    "Rabi II",
    "Jumada I",
    "Jumada II",
    "Rajab",
    "Shabaan",
    "Ramadaan",
    "Shawwal",
    "Zilqadah",
    "Zilhaj"
  ]
};

class HijriDate {
  constructor(year, month, day) {
    this.year = year;
    this.month = month; // 0-indexed (0 = Moharram, 11 = Zilhaj)
    this.day = day;     // 1-30
  }

  getYear() { return this.year; }
  getMonth() { return this.month; }
  getDate() { return this.day; }

  static getMonthName(month) {
    return MONTH_NAMES.long[month] || '';
  }

  static getShortMonthName(month) {
    return MONTH_NAMES.short[month] || '';
  }

  static isJulian(date) {
    const y = date.getFullYear();
    if (y < 1582) return true;
    if (y === 1582) {
      const m = date.getMonth();
      if (m < 9) return true;
      if (m === 9 && date.getDate() < 5) return true;
    }
    return false;
  }

  static gregorianToAJD(date) {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    const day = date.getDate()
      + date.getHours() / 24
      + date.getMinutes() / 1440
      + date.getSeconds() / 86400
      + date.getMilliseconds() / 86400000;

    if (month < 3) {
      year--;
      month += 12;
    }

    let b;
    if (HijriDate.isJulian(date)) {
      b = 0;
    } else {
      const a = Math.floor(year / 100);
      b = 2 - a + Math.floor(a / 4);
    }
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
  }

  static isKabisa(year) {
    return KABISA_YEAR_REMAINDERS.includes(year % 30);
  }

  static fromAJD(ajd) {
    let i = 0;
    let left = Math.floor(ajd - 1948083.5);
    const y30 = Math.floor(left / 10631.0);

    left -= y30 * 10631;
    while (left > DAYS_IN_30_YEARS[i]) {
      i += 1;
    }

    let year = Math.round(y30 * 30.0 + i);
    if (i > 0) {
      left -= DAYS_IN_30_YEARS[i - 1];
    }
    i = 0;
    while (left > DAYS_IN_YEAR[i]) {
      i += 1;
    }
    const month = Math.round(i);
    const date = (i > 0) ? Math.round(left - DAYS_IN_YEAR[i - 1]) : Math.round(left);

    return new HijriDate(year, month, date);
  }

  static fromGregorian(date) {
    return HijriDate.fromAJD(HijriDate.gregorianToAJD(date));
  }
}

/**
 * Format a given Gregorian date into Mumineen Hijri date string.
 * @param {Date|string|moment.Moment} value 
 * @param {Object} [options]
 * @param {'short'|'long'} [options.monthFormat='short']
 * @returns {string} e.g. "9 Safar 1448" or "9 Safar al-Muzaffar 1448"
 */
function formatHijriDate(value, options = {}) {
  if (!value) return '';

  const monthFormat = options.monthFormat || 'short';

  try {
    let m;
    if (moment.isMoment(value)) {
      m = value.clone().tz("Asia/Kolkata");
    } else if (value instanceof Date) {
      m = moment(value).tz("Asia/Kolkata");
    } else {
      m = moment.tz(value, "Asia/Kolkata");
    }

    if (!m.isValid()) return '';

    // Extract calendar date components in IST
    const y = m.year();
    const mon = m.month(); // 0-indexed
    const d = m.date();

    // Use noon (12:00:00) to prevent Astronomical Julian Date boundary issues
    const noonDate = new Date(y, mon, d, 12, 0, 0);
    const hd = HijriDate.fromGregorian(noonDate);

    const monthName = monthFormat === 'short' 
      ? HijriDate.getShortMonthName(hd.getMonth()) 
      : HijriDate.getMonthName(hd.getMonth());

    return `${hd.getDate()} ${monthName} ${hd.getYear()}`;
  } catch (err) {
    console.error('Error formatting Mumineen Hijri date:', err);
    return '';
  }
}

module.exports = {
  HijriDate,
  formatHijriDate
};
