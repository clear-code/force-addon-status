# Abstract

This addon provides ability to control enabled/disabled status of addons.
This is mainly designed for corporate-use.

# Usage

## For Extensions

If you want an addon "tbtestpilot@labs.mozilla.com" to be controlled, then
create a string preference for the addon, like:

    pref("extensions.force-addon-status@clear-code.com.addons.tbtestpilot@labs.mozilla.com.status", "enabled");

Possible values:

  * `enabled`
  * `disabled`
  * `uninstall`
  * `global`

You can specify two or more values as a comma-separated list, like:

    pref("extensions.force-addon-status@clear-code.com.addons.tbtestpilot@labs.mozilla.com.status",
           "global,enabled");

If you set the value to `global` and the addon is installed to the user profile, then the user profile version will be uninstalled and the globally installed version will become active.

You can specify wildcards ("?" and "*") in the addon id.

## For Plugins

If you want a plugin named "Java(TM) Plug-in ..." to be controlled, then
you have to create two preferences like:

    pref("extensions.force-addon-status@clear-code.com.plugins.0.pattern",
         "^Java\(TM\) Plug-in");
    pref("extensions.force-addon-status@clear-code.com.plugins.0.status",
         false);

The value of ".pattern" is a regular expression (case sensitive) for the name
of the plugin, because addon-id for plugins are modified on every install.

If the value of ".status" is `true`, then the plugin will be activated. Otherwise disabled.
