load('lib/jsdeferred');
load('lib/prefs');

Components.utils.import('resource://gre/modules/AddonManager.jsm');

(function() {
  var deferredTasks = [];

  var prefix = 'extensions.force-addon-status@clear-code.com.addons.';
  var keys = prefs.getDescendant(prefix);
  keys.forEach(function(aKey) {
    var id = aKey.replace(prefix, '');
    var shouldBeActive = prefs.getPref(aKey);
    var deferred = new Deferred();
    AddonManager.getAddonByID(id, function(aAddon) {
      if (!aAddon || aAddon.isActive == shouldBeActive)
        return deferred.call(false);

      aAddon.userDisabled = !shouldBeActive;
      deferred.call(true);
    });
    deferredTasks.push(deferred);
  });

  if (deferredTasks.length)
    Deferred
      .parallel(deferredTasks)
      .next(function(results) {
        if (results.some(function(aChanged) {
              return aChanged;
            })) {
          Cc['@mozilla.org/toolkit/app-startup;1']
            .getService(Ci.nsIAppStartup)
            .quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eForceQuit);
        }
      });
})();

function shutdown()
{
  prefs = undefined;
  Deferred = undefined;
  AddonManager = undefined;
  AddonManagerPrivate = undefined;
}
