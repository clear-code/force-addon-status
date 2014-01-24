# Abstract

This addon provides ability to control enabled/disabled status of addons.

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

You can specify two or more values as a comma-separated likt, like:

    pref("extensions.force-addon-status@clear-code.com.addons.tbtestpilot@labs.mozilla.com.status",
           "global,enabled");

If you set the value to `global` and the addon is installed to the user profile, then the user profile version will be uninstalled and the globally installed version will become active.

### Deprecated method

By the way, this is a deprecated method but you can control addons with boolean preferences like:

    pref("extensions.force-addon-status@clear-code.com.addons.tbtestpilot@labs.mozilla.com", true);

The value "true" means "keep the addon enabled always".
Even if the user disables the addon, it will be enabled on the next startup
automatically.

The value "false" means "keep the addon disabled always".
Even if the user installs or activates the addon, it will be disalbed on the
next startup automatically.

## For Plugins

If you want a plugin named "Java(TM) Plug-in ..." to be controlled, then
you have to create two preferences like:

    pref("extensions.force-addon-status@clear-code.com.plugins.0.pattern",
         "^Java\(TM\) Plug-in");
    pref("extensions.force-addon-status@clear-code.com.plugins.0.status",
         false);

The value of ".pattern" is a regular expression (case sensitive) for the name
of the plugin, because addon-id for plugins are modified on every install.

The meaning of the value of ".status" is just same to
"extensions.force-addon-status@clear-code.com.addons.*".
