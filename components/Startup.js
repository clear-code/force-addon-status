const DEBUG = false;

var gLogger = {
  messages: [],
  log: function(aMessage) {
    this.messages.push(aMessage);
    this.output(aMessage);
  },
  output: function(aMessage) {
    if (aMessage) {
      Cc['@mozilla.org/consoleservice;1']
        .getService(Ci.nsIConsoleService)
        .logStringMessage('[force-addon-status] ' + aMessage);
    }
    if (!DEBUG)
      return;
    Components.utils.import('resource://force-addon-status-modules/lib/textIO.jsm');
    var file = Cc['@mozilla.org/file/directory_service;1']
                 .getService(Ci.nsIProperties)
                 .get('Desk', Ci.nsIFile);
    file.append('force-addon-status.log');
    var previous = textIO.readFrom(file, 'UTF-8') || '';
    var log;
    if (aMessage) {
      log = previous + '\n[' + (new Date()) + '] ' + aMessage;
    } else {
      log = [previous, this.messages.join('\n')].join('\n-----' + (new Date()) + '-----\n');
    }
    textIO.writeTo(log, file, 'UTF-8');
/*
    Cc['@mozilla.org/embedcomp/prompt-service;1']
      .getService(Ci.nsIPromptService)
      .alert(null, kID, file.path+'\n\n'+this.messages.join('\n'));;
*/
  }
}

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
  this.ready = false;
  this.active = false;
}
ForceAddonStatusStartupService.prototype = {
  classID          : kCID,
  contractID       : kID,
  classDescription : kNAME,
   
  observe : function(aSubject, aTopic, aData) 
  {
    gLogger.log('observe: ' + aTopic);
    switch (aTopic)
    {
      case 'profile-after-change':
        ObserverService.addObserver(this, 'final-ui-startup', false);
        ObserverService.addObserver(this, 'sessionstore-windows-restored', false);
        ObserverService.addObserver(this, 'mail-startup-done', false);
        return;

      case 'final-ui-startup':
        ObserverService.removeObserver(this, 'final-ui-startup');
        this.registerListener();
        var self = this;
        return this.waitUntilStarted()
          .next(function() {
            return self.checkStatus();
          })
          .next(function() {
            self.active = true;
          });
        return;

      case 'sessionstore-windows-restored':
      case 'mail-startup-done':
        ObserverService.removeObserver(this, 'sessionstore-windows-restored');
        ObserverService.removeObserver(this, 'mail-startup-done');
        this.ready = true;
        if (this.waitUntilStarted_trigger)
          this.waitUntilStarted_trigger.call();
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
    return Deferred.next(function() {
        return self.checkExtensionsStatus(changedCount);
      })
      .next(function() {
        return self.checkPluginsStatus();
      })
      .next(function() {
        gLogger.log(changedCount.value + ' changed addon(s)');
        if (changedCount.value > 0)
          self.restart();
      })
      .error(function(error) {
        Components.utils.reportError(error);
        gLogger.log('unexpected error: ' + error + '\n' + error.stack);
      })
      .next(function() {
        self.checking = false;
      });
  },

  checkExtensionsStatus : function(aChangedCount)
  {
    gLogger.log('ForceAddonStatusStartupService::checkExtensionsStatus');
    var deferredTasks = [];

    var prefix = BASE + 'addons.';
    var keys = prefs.getDescendant(prefix);
    aChangedCount.value = aChangedCount.value || 0;
    keys.forEach(function(aKey) {
      if (!aKey)
        return;

      var id = aKey.replace(prefix, '');
      gLogger.log('  id ' + id);
      var newStatus;
      if (/\.status$/.test(id)) {
        newStatus = prefs.getPref(aKey);
        id = id.replace(/\.status$/, '');
        gLogger.log('  => ' + id);
      } else { // backward compatibility
        newStatus = prefs.getPref(aKey);
        if (newStatus)
          newStatus = 'enabled';
        else
          newStatus = 'disabled';
      }

      newStatus = String(newStatus).toLowerCase();

      gLogger.log('  newStatus ' + newStatus);

      var generateAddonProcessor = function() {
        var deferred = new Deferred();
        var callback = function(aAddon) {
        if (!aAddon) {
          gLogger.log('  => not installed.');
          return deferred.call();
        }

        var shouldBeActive = newStatus.indexOf('enabled') > -1 || newStatus.indexOf('disabled') < 0;
        if (newStatus.indexOf('disabled') > -1)
          shouldBeActive = false;

        gLogger.log('  shouldBeActive ' + shouldBeActive);
        if (aAddon.isActive != shouldBeActive) {
          aAddon.userDisabled = !shouldBeActive;
          gLogger.log(aAddon.userDisabled ? ' => deactivated' : ' => activated');
          aChangedCount.value++;
        }

        var shouldUninstall = newStatus.indexOf('uninstall') > -1;
        gLogger.log('  shouldUninstall ' + shouldUninstall);
        var shouldGlobal = newStatus.indexOf('global') > -1;
        gLogger.log('  shouldGlobal ' + shouldGlobal);
        var isGlobal = aAddon.scope != AddonManager.SCOPE_PROFILE;
        gLogger.log('  isGlobal ' + isGlobal + ' (scope=' + aAddon.scope + ', profile=' + AddonManager.SCOPE_PROFILE + ')');
        if (shouldUninstall || shouldGlobal != isGlobal) {
          aAddon.uninstall();
          gLogger.log(' => uninstalled');
          aChangedCount.value++;
        }

        deferred.call();
        };
        return {
          callback: callback,
          deferred: deferred
        };
      };

      if (!/[\*\?]/.test(id)) {
        let processor = generateAddonProcessor();
        deferredTasks.push(processor.deferred);
        AddonManager.getAddonByID(id, processor.callback);
      }
      else {
        let deferred = new Deferred();
        let matcher = new RegExp(id.replace(/\?/g, '.').replace(/\*/g, '.*'));
        gLogger.log('change status of addons matched to <' + matcher + '>');
        AddonManager.getAddonsByTypes(['extension'], function(aAddons) {
          gLogger.log('all installed extensions: ' + aAddons.length);
          aAddons.forEach(function(aAddon) {
            gLogger.log('id = ' + aAddon.id);
            if (!matcher.test(aAddon.id))
              return;
            gLogger.log(' => matched');
            var processor = generateAddonProcessor();
            processor.callback(aAddon);
          });
          deferred.call();
        });
        deferredTasks.push(deferred);
      }
    });

    gLogger.log('deferred tasks: ' + deferredTasks.length);

    if (deferredTasks.length == 1)
      return deferredTasks[0];

    if (deferredTasks.length > 1)
      return Deferred.parallel(deferredTasks);
  },

  checkPluginsStatus : function()
  {
    var controlledPlugins = prefs.getChildren(BASE + 'plugins.');
    if (controlledPlugins.length == 0)
      return;

    var allPatterns = [];
    controlledPlugins = controlledPlugins.map(function(aEntryBaseKey) {
      var pattern = prefs.getPref(aEntryBaseKey + '.pattern');
      if (!pattern) return null;
      allPatterns.push(pattern);
      return {
        pattern :        new RegExp(pattern),
        enabledState : prefs.getPref(aEntryBaseKey + '.enabledState')
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
        }
        if (aControl.enabledState !== null &&
            aPluginTag.enabledState !== !aControl.enabledState) {
          aPluginTag.enabledState = aControl.enabledState;
          gLogger.log('aPluginTag.enabledState => ' + aPluginTag.enabledState);
        }
        return true;
      });
    });
  },

  registerListener : function()
  {
    AddonManager.addAddonListener(this);
  },
  onEnabling : function(aAddon, aNeedsRestart) {
    if (this.active)
      this.checkStatus();
  },
  onEnabled : function(aAddon) {
  },
  onDisabling : function(aAddon, aNeedsRestart) {
    if (this.active)
      this.checkStatus();
  },
  onDisabled : function(aAddon) {
  },
  onInstalling : function(aAddon, aNeedsRestart) {
    if (this.active)
      this.checkStatus();
  },
  onInstalled : function(aAddon) {
  },
  onUninstalling : function(aAddon, aNeedsRestart) {
    if (this.active)
      this.checkStatus();
  },
  onUninstalled : function(aAddon) {
  },
  onOperationCancelled : function(aAddon) {
    if (this.active)
      this.checkStatus();
  },
  onPropertyChanged : function(aAddon, aProperties) {
    if (this.active)
      this.checkStatus();
  },

  waitUntilStarted : function() {
    if (this.ready)
      return;

    this.waitUntilStarted_trigger = new Deferred();
    return this.waitUntilStarted_trigger;
  },

  restart : function()
  {
    gLogger.log('try to restart');
    Cc['@mozilla.org/toolkit/app-startup;1']
      .getService(Ci.nsIAppStartup)
      .quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
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
