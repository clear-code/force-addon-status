{// Force Addon Status, for Firefox 52/Thunderbird 52 and later
  let { classes: Cc, interfaces: Ci, utils: Cu } = Components;
  let { Services } = Cu.import('resource://gre/modules/Services.jsm', {});
  let { AddonManager } = Cu.import('resource://gre/modules/AddonManager.jsm', {});
  const BASE = 'extensions.force-addon-status@clear-code.com.';

  let getDescendantPrefs = (aRoot) => {
    return Services.prefs.getChildList(aRoot, {}).sort();
  };
  let getChildPrefs = (aRoot) => {
    aRoot = aRoot.replace(/\.$/, '');
    var foundChildren = {};
    var possibleChildren = [];
    getDescendantPrefs(aRoot)
      .forEach(aPrefstring => {
        let name = aPrefstring.replace(aRoot + '.', '');
        let possibleChildKey = aRoot + '.' + name.split('.')[0];
        if (possibleChildKey && !(possibleChildKey in foundChildren)) {
          possibleChildren.push(possibleChildKey);
          foundChildren[possibleChildKey] = true;
        }
      });
    return possibleChildren.sort();
  };

  let restart = () => {
    Cc['@mozilla.org/toolkit/app-startup;1']
      .getService(Ci.nsIAppStartup)
      .quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
  };

  let statusChecker = {
    ready: false,
    active: false,

    observe: async function(aSubject, aTopic, aData) {
      switch (aTopic) {
        case 'final-ui-startup':
          Services.obs.removeObserver(statusChecker, 'final-ui-startup');
          AddonManager.addAddonListener(this);
          break;

        case 'sessionstore-windows-restored':
        case 'mail-startup-done':
          Services.obs.removeObserver(statusChecker, 'sessionstore-windows-restored');
          Services.obs.removeObserver(statusChecker, 'mail-startup-done');
          await this.checkStatus()
          this.active = true;
          break;
      }
    },

    checkStatus: async function() {
      if (this.checking)
        return;
      this.checking = true;

      try {
        var changedCount = 0;
        changedCount += await this.checkExtensionsStatus();
        changedCount += this.checkPluginsStatus();
        if (changedCount > 0)
          return restart();
      }
      catch(e) {
        Components.utils.reportError(e);
        this.checking = false;
      }
    },

    checkExtensionsStatus: async function() {
      var count = 0;
      var prefix = `${BASE}addons.`;
      var keys = getDescendantPrefs(prefix);
      for (let key of keys) {
        if (!key)
          continue;
        let id = key.replace(prefix, '');

        let addons;
        if (!/[\*\?]/.test(id)) {
          addons = [await new Promise((aResolve, aReject) => AddonManager.getAddonByID(id, aResolve))];
        }
        else {
          addons = await new Promise((aResolve, aReject) => AddonManager.getAddonsByTypes(['extension'], aResolve));
          let matcher = new RegExp(id.replace(/\?/g, '.').replace(/\*/g, '.*'));
          addons = addons.filter(aAddon => matcher.test(aAddon.id));
        }

        let newStatus;
        if (/\.status$/.test(id)) {
          newStatus = String(getPref(key)).toLowerCase();
          id = id.replace(/\.status$/, '');
        }
        else { // backward compatibility
          newStatus = getPref(key) ? 'enabled' : 'disabled';
        }
        let shouldBeActive = newStatus.indexOf('enabled') > -1 || newStatus.indexOf('disabled') < 0;
        if (newStatus.indexOf('disabled') > -1)
          shouldBeActive = false;

        for (let addon of addons) {
          if (!addon)
            continue;

          if (addon.isActive != shouldBeActive) {
            aAddon.userDisabled = !shouldBeActive;
            count++;
          }
          let shouldUninstall = newStatus.indexOf('uninstall') > -1;
          let shouldGlobal = newStatus.indexOf('global') > -1;
          let isGlobal = aAddon.scope != AddonManager.SCOPE_PROFILE;
          if (shouldUninstall || shouldGlobal != isGlobal) {
            addon.uninstall();
            count++;
          }
        }
      }
      return count;
    },

    checkPluginsStatus: function() {
      var controlledPlugins = getChildPrefs(`${BASE}plugins.`);
      if (controlledPlugins.length == 0)
        return 0;

      var allPatterns = [];
      controlledPlugins = controlledPlugins.map(aEntryBaseKey => {
        var pattern = getPref(aEntryBaseKey + '.pattern');
        if (!pattern)
          return null;
        allPatterns.push(pattern);
        return {
          pattern :      new RegExp(pattern),
          enabledState : getPref(`${aEntryBaseKey}.enabledState`)
        };
      }).filter(aControl => !!aControl);

      allPatterns = new RegExp(`(${allPatterns.join('|')})`);

      var PluginHost = Cc['@mozilla.org/plugin/host;1']
                        .getService(Ci.nsIPluginHost);
      var plugins = PluginHost.getPluginTags();
      for (let plugin of plugins) {
        if (!allPatterns.test(plugin.name))
          continue;

        for (let control of controlledPlugins) {
          if (!control.pattern.test(plugin.name))
            continue;
          if (control.enabledState !== null &&
              plugin.enabledState !== !control.enabledState) {
            plugin.enabledState = control.enabledState;
          }
          break;
        }
      }
    },

    // addon listener
    onEnabling(aAddon, aNeedsRestart) {
      if (this.active)
        this.checkStatus();
    },
    onEnabled(aAddon) {},
    onDisabling(aAddon, aNeedsRestart) {
      if (this.active)
        this.checkStatus();
    },
    onDisabled(aAddon) {},
    onInstalling(aAddon, aNeedsRestart) {
      if (this.active)
        this.checkStatus();
    },
    onInstalled(aAddon) {},
    onUninstalling(aAddon, aNeedsRestart) {
      if (this.active)
        this.checkStatus();
    },
    onUninstalled(aAddon) {},
    onOperationCancelled(aAddon) {
      if (this.active)
        this.checkStatus();
    },
    onPropertyChanged(aAddon, aProperties) {
      if (this.active)
        this.checkStatus();
    }
  };
  Services.obs.addObserver(statusChecker, 'final-ui-startup', false);
  Services.obs.addObserver(statusChecker, 'sessionstore-windows-restored', false);
  Services.obs.addObserver(statusChecker, 'mail-startup-done', false);
}