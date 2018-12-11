{// Force Addon Status, for Firefox 52/Thunderbird 52 and later
  const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
  const { Services } = Cu.import('resource://gre/modules/Services.jsm', {});
  const { AddonManager } = Cu.import('resource://gre/modules/AddonManager.jsm', {});
  const BASE = 'extensions.force-addon-status@clear-code.com.';

  const log = (aMessage) => {
    Services.console.logStringMessage(`[force-addon-status] ${aMessage}`);
  };

  const getDescendantPrefs = (aRoot) => {
    return Services.prefs.getChildList(aRoot, {}).sort();
  };
  const getChildPrefs = (aRoot) => {
    aRoot = aRoot.replace(/\.$/, '');
    const foundChildren = {};
    const possibleChildren = [];
    getDescendantPrefs(aRoot)
      .forEach(aPrefstring => {
        const name = aPrefstring.replace(`${aRoot}.`, '');
        const possibleChildKey = `${aRoot}.${name.split('.')[0]}`;
        if (possibleChildKey && !(possibleChildKey in foundChildren)) {
          possibleChildren.push(possibleChildKey);
          foundChildren[possibleChildKey] = true;
        }
      });
    return possibleChildren.sort();
  };

  const restart = () => {
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
          log('register addon listener');
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
      log('checkStatus');
      if (this.checking)
        return;
      this.checking = true;

      try {
        const changedCount = await this.checkExtensionsStatus();
        log(`changed count = ${changedCount}`);
        if (changedCount > 0)
          return restart();
      }
      catch(e) {
        Components.utils.reportError(e);
        this.checking = false;
      }
    },

    checkExtensionsStatus: async function() {
      log('checkExtensionsStatus');
      let count = 0;
      const PREFIX = `${BASE}addons.`;
      const keys = getDescendantPrefs(PREFIX);
      for (let key of keys) {
        if (!key)
          continue;

        let id = key.replace(PREFIX, '');

        let newStatus;
        if (/\.status$/.test(key)) {
          newStatus = String(getPref(key)).toLowerCase();
          id = id.replace(/\.status$/, '');
        }
        else { // backward compatibility
          newStatus = getPref(key) ? 'enabled' : 'disabled';
        }
        let shouldBeActive = newStatus.indexOf('enabled') > -1 || newStatus.indexOf('disabled') < 0;
        if (newStatus.indexOf('disabled') > -1)
          shouldBeActive = false;

        log(`finding ${id}`);

        let addons;
        if (!/[\*\?]/.test(id)) {
          addons = [await new Promise((aResolve, aReject) => AddonManager.getAddonByID(id, aResolve))];
        }
        else {
          addons = await new Promise((aResolve, aReject) => AddonManager.getAddonsByTypes(['extension'], aResolve));
          const matcher = new RegExp(id.replace(/\?/g, '.').replace(/\*/g, '.*'));
          addons = addons.filter(aAddon => matcher.test(aAddon.id));
        }
        log(` => ${addons.length} addon matched`);

        for (let addon of addons) {
          log(`updating ${addon}`);
          if (!addon || addon.appDisabled)
            continue;

          log(`check status of ${addon.name}`);
          if (addon.isActive != shouldBeActive) {
            addon.userDisabled = !shouldBeActive;
            log(` => disabled or enabled`);
            count++;
          }
          const shouldUninstall = newStatus.indexOf('uninstall') > -1;
          const shouldGlobal = newStatus.indexOf('global') > -1;
          const isGlobal = addon.scope != AddonManager.SCOPE_PROFILE;
          if (shouldUninstall || shouldGlobal != isGlobal) {
            log(` => uninstall`);
            addon.uninstall();
            count++;
          }
        }
      }
      return count;
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
