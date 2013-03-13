const kCID  = Components.ID('{cd2892e0-87a8-11e2-9e96-0800200c9a66}'); 
const kID   = '@clear-code.com/force-addon-status/startup;1';
const kNAME = 'ForceAddonStatusStartupService';

const Cc = Components.classes;
const Ci = Components.interfaces;

const ObserverService = Cc['@mozilla.org/observer-service;1']
                         .getService(Ci.nsIObserverService);

Components.utils.import('resource://gre/modules/AddonManager.jsm');

Components.utils.import('resource://force-addon-status-modules/lib/prefs.js');
Components.utils.import('resource://force-addon-status-modules/lib/jsdeferred.js');

const BASE = 'extensions.force-addon-status@clear-code.com.';

function ForceAddonStatusStartupService() { 
}
ForceAddonStatusStartupService.prototype = {
  classID          : kCID,
  contractID       : kID,
  classDescription : kNAME,
   
  observe : function(aSubject, aTopic, aData) 
  {
    switch (aTopic)
    {
      case 'profile-after-change':
        ObserverService.addObserver(this, 'final-ui-startup', false);
        return;

      case 'final-ui-startup':
        ObserverService.removeObserver(this, 'final-ui-startup');
        this.checkStatus();
        return;
    }
  },
 
  checkStatus : function() 
  {
    var self = this;
    var changedCount = { value : 0 };
    this.checkStatusForIDs(changedCount)
      .next(function(results) {
        if (changedCount.value > 0) {
          self.restart();
        }
      })
      .error(function(error) {
        Components.utils.reportError(error);
      });
  },

  checkStatusForIDs : function(aChangedCount)
  {
    var deferredTasks = [];

    var prefix = BASE + 'addons.';
    var keys = prefs.getDescendant(prefix);
    aChangedCount.value = aChangedCount.value || 0;
    keys.forEach(function(aKey) {
      var id = aKey.replace(prefix, '');
      var shouldBeActive = prefs.getPref(aKey);
      var deferred = new Deferred();
      AddonManager.getAddonByID(id, function(aAddon) {
        if (!aAddon || aAddon.isActive == shouldBeActive)
          return deferred.call();

        aAddon.userDisabled = !shouldBeActive;
        aChangedCount.value++;
        deferred.call();
      });
      deferredTasks.push(deferred);
    });

    if (deferredTasks.length > 0)
      return Deferred.parallel(deferredTasks);
    else
      return Deferred;
  },

  restart : function()
  {
    Cc['@mozilla.org/toolkit/app-startup;1']
      .getService(Ci.nsIAppStartup)
      .quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eForceQuit);
  },
  
  QueryInterface : function(aIID) 
  {
    if(!aIID.equals(Ci.nsIObserver) &&
       !aIID.equals(Ci.nsISupports)) {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  }
};

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
var NSGetFactory = XPCOMUtils.generateNSGetFactory([ForceAddonStatusStartupService]);
