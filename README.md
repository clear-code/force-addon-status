# Abstract

This addon provides ability to control enabled/disabled status of addons.

# Usage

If you want an addon "tbtestpilot@labs.mozilla.com" to be controlled, then
you have to create a boolean preference like:

    pref("extensions.force-addon-status@clear-code.com.addons.tbtestpilot@labs.mozilla.com", true);

The value "true" means "keep the addon enabled always". Even if the user disables the addon, it will be enabled on the next startup automatically.

The value "false" means "keep the addon disabled always". Even if the user installs or activates the addon, it will be disalbed on the next startup automatically.

