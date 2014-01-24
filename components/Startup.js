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
        var self = this;
        this.checkStatus()
          .next(function() {
            self.registerListener();
          });
        return;
    }
  },
 
  checkStatus : function() 
  {
    if (this.checking)
      return;
    this.checking = true;

    var self = this;
    var changedCount = { value : 0 };
    return this.checkExtensionsStatus(changedCount)
      .next(function() {
        return self.checkPluginsStatus();
      })
      .next(function() {
        if (changedCount.value > 0) {
          self.restart();
        }
      })
      .error(function(error) {
        Components.utils.reportError(error);
      })
      .next(function() {
        self.checking = false;
      });
  },

  checkExtensionsStatus : function(aChangedCount)
  {
    var deferredTasks = [];

    var prefix = BASE + 'addons.';
    var keys = prefs.getDescendant(prefix);
    aChangedCount.value = aChangedCount.value || 0;
    keys.forEach(function(aKey) {
      if (!aKey)
        return;

      var id = aKey.replace(prefix, '');
      var newStatus;
      if (/\.status$/.test(id)) {
        newStatus = prefs.getPref(aKey);
        id = id.replace(/\.status$/, '');
      } else { // backward compatibility
        newStatus = prefs.getPref(aKey);
        if (newStatus)
          newStatus = 'enabled';
        else
          newStatus = 'disabled';
      }

      newStatus = String(newStatus).toLowerCase();

      var deferred = new Deferred();
      AddonManager.getAddonByID(id, function(aAddon) {
        if (!aAddon)
          return deferred.call();

        var shouldBeActive = newStatus.indexOf('enabled') > -1 || newStatus.indexOf('disabled') < 0;
        if (newStatus.indexOf('disabled') > -1)
          shouldBeActive = false;
        if (aAddon.isActive != shouldBeActive) {
          aAddon.userDisabled = !shouldBeActive;
          aChangedCount.value++;
        }

        var shouldUninstall = newStatus.indexOf('uninstall') > -1;
        var shouldGlobal = newStatus.indexOf('global') > -1;
        var isGlobal = aAddon.scope != AddonManager.SCOPE_PROFILE;
        if (shouldUninstall || shouldGlobal != isGlobal) {
          aAddon.uninstall();
          aChangedCount.value++;
        }

        deferred.call();
      });
      deferredTasks.push(deferred);
    });

    if (deferredTasks.length > 0)
      return Deferred.parallel(deferredTasks);
    else
      return Deferred;
  },

  checkPluginsStatus : function()
  {
    var controlledPlugins = prefs.getChildren(BASE + 'plugins.');
    if (controlledPlugins.length == 0)
      return Deferred;

    var allPatterns = [];
    controlledPlugins = controlledPlugins.map(function(aEntryBaseKey) {
      var pattern = prefs.getPref(aEntryBaseKey + '.pattern');
      if (!pattern) return null;
      allPatterns.push(pattern);
      return {
        pattern :        new RegExp(pattern),
        shouldBeActive : prefs.getPref(aEntryBaseKey + '.status'),
        blocklisted :    prefs.getPref(aEntryBaseKey + '.blocklisted')
      };
    });
    controlledPlugins = controlledPlugins.filter(function(aControl) {
      return aControl;
    });

    allPatterns = new RegExp('(' + allPatterns.join('|') + ')');

    var PluginHost = Cc['@mozilla.org/plugin/host;1']
                      .getService(Ci.nsIPluginHost);
    var plugins = PluginHost.getPluginTags();
    plugins.forEach(function(aPluginTag) {
      if (!allPatterns.test(aPluginTag.name))
        return;

      controlledPlugins.some(function(aControl) {
        if (!aControl.pattern.test(aPluginTag.name))
          return false;
        if (aControl.shouldBeActive !== null &&
            aPluginTag.disabled !== !aControl.shouldBeActive) {
          aPluginTag.disabled = !aControl.shouldBeActive;
        }
        if (aControl.blocklisted !== null &&
            aPluginTag.blocklisted !== aControl.blocklisted) {
          aPluginTag.blocklisted = !!aControl.blocklisted;
        }
        return true;
      });
    });

    return Deferred;
  },

  registerListener : function()
  {
    AddonManager.addAddonListener(this);
  },
  deferredCheckStatus : function() {
    var self = this;
    return Deferred.next(function() {
      return self.checkStatus();
    });
  },
  onEnabling : function(aAddon, aNeedsRestart) {
    this.deferredCheckStatus();
  },
  onEnabled : function(aAddon) {
  },
  onDisabling : function(aAddon, aNeedsRestart) {
    this.deferredCheckStatus();
  },
  onDisabled : function(aAddon) {
  },
  onInstalling : function(aAddon, aNeedsRestart) {
    this.deferredCheckStatus();
  },
  onInstalled : function(aAddon) {
  },
  onUninstalling : function(aAddon, aNeedsRestart) {
    this.deferredCheckStatus();
  },
  onUninstalled : function(aAddon) {
  },
  onOperationCancelled : function(aAddon) {
    this.deferredCheckStatus();
  },
  onPropertyChanged : function(aAddon, aProperties) {
    this.deferredCheckStatus();
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
