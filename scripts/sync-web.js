const fs = require('fs');
const path = require('path');

const rootHtmlPath = path.join(__dirname, '..', 'index.html');
const wwwDir = path.join(__dirname, '..', 'www');
const wwwHtmlPath = path.join(wwwDir, 'index.html');

let html = fs.readFileSync(rootHtmlPath, 'utf8');

const bridgeAnchor = '<audio id="alarmAudio" loop></audio>\n\n<script>';
if (!html.includes(bridgeAnchor)) {
  throw new Error('sync-web: no encontré el punto de inserción del puente nativo en index.html');
}
html = html.replace(
  bridgeAnchor,
  '<audio id="alarmAudio" loop></audio>\n\n<script src="native-bridge.bundle.js"></script>\n<script>'
);

const integrationScript = `
<script>
(function () {
  function syncNative() {
    if (window.NativeAlarm && window.NativeAlarm.isNative) {
      window.NativeAlarm.syncAllAlarms(loadAlarms());
    }
  }

  var _saveAlarm = window.saveAlarm;
  window.saveAlarm = function () {
    _saveAlarm();
    syncNative();
  };

  var _toggleAlarm = window.toggleAlarm;
  window.toggleAlarm = function (id, enabled) {
    _toggleAlarm(id, enabled);
    syncNative();
  };

  var _deleteAlarm = window.deleteAlarm;
  window.deleteAlarm = function (id) {
    var existedBefore = loadAlarms().some(function (a) { return a.id === id; });
    _deleteAlarm(id);
    var existsAfter = loadAlarms().some(function (a) { return a.id === id; });
    if (existedBefore && !existsAfter && window.NativeAlarm && window.NativeAlarm.isNative) {
      window.NativeAlarm.cancelNativeAlarm(id);
    }
    syncNative();
  };

  if (window.NativeAlarm) {
    window.NativeAlarm.onAlarmOpened(function (alarmId) {
      var alarm = loadAlarms().find(function (a) { return a.id === alarmId; });
      if (alarm) fireAlarm(alarm);
    });
  }

  syncNative();
})();
</script>
`;

const bodyCloseAnchor = '</body>';
const lastBodyCloseIndex = html.lastIndexOf(bodyCloseAnchor);
if (lastBodyCloseIndex === -1) {
  throw new Error('sync-web: no encontré </body> en index.html');
}
html = html.slice(0, lastBodyCloseIndex) + integrationScript + html.slice(lastBodyCloseIndex);

fs.mkdirSync(wwwDir, { recursive: true });
fs.writeFileSync(wwwHtmlPath, html);
console.log('www/index.html generado a partir de index.html');
