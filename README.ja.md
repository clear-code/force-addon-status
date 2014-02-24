# 概要

このアドオンは、アドオンの有効・無効の状態を管理するための機能を提供します。
このアドオンは主に法人利用を想定して開発されています。

# 使い方

## 拡張機能の管理

例えばアドオン「tbtestpilot@labs.mozilla.com」を管理する場合、以下のような設定項目を作成します。

    pref("extensions.force-addon-status@clear-code.com.addons.tbtestpilot@labs.mozilla.com.status", "enabled");

指定できる値は以下の通りです。

  * `enabled`
  * `disabled`
  * `uninstall`
  * `global`

値はカンマ区切りで複数列挙できます。

    pref("extensions.force-addon-status@clear-code.com.addons.tbtestpilot@labs.mozilla.com.status",
           "global,enabled");

もし値に `global` が含まれていて、且つアドオンがユーザープロファイル内にインストールされている場合には、プロファイル内にインストールされているバージョンは自動的にアンインストールされ、グローバルにインストールされている方のバージョンが有効になります。

## プラグインの管理

例えば「Java(TM) Plug-in ...」のような名前のプラグインを管理する場合、以下のような設定項目を作成します。

    pref("extensions.force-addon-status@clear-code.com.plugins.0.pattern",
         "^Java\(TM\) Plug-in");
    pref("extensions.force-addon-status@clear-code.com.plugins.0.status",
         false);

「.pattern」の値は、プラグイン名に対して適用される、大文字小文字を区別する正規表現です。
これは、プラグインのアドオンとしてのIDがインストールの度に変化するためです。

「.status」の値がtrueであればプラグインを有効化し、falseであれば無効化します。
