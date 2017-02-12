export default function (format) {
  function clockFormat(seconds, decimals) {
    const hours = parseInt(seconds / 3600, 10) % 24;
    const minutes = parseInt(seconds / 60, 10) % 60;
    const secs = (seconds % 60).toFixed(decimals);

    const sHours = (hours < 10) ? `0${hours}` : hours;
    const sMinutes = (minutes < 10) ? `0${minutes}` : minutes;
    const sSeconds = (secs < 10) ? `0${secs}` : secs;

    return `${sHours}:${sMinutes}:${sSeconds}`;
  }

  const formats = {
    seconds(seconds) {
      return seconds.toFixed(0);
    },
    thousandths(seconds) {
      return seconds.toFixed(3);
    },
    'hh:mm:ss': function hhmmss(seconds) {
      return clockFormat(seconds, 0);
    },
    'hh:mm:ss.u': function hhmmssu(seconds) {
      return clockFormat(seconds, 1);
    },
    'hh:mm:ss.uu': function hhmmssuu(seconds) {
      return clockFormat(seconds, 2);
    },
    'hh:mm:ss.uuu': function hhmmssuuu(seconds) {
      return clockFormat(seconds, 3);
    },
  };

  return formats[format];
}
