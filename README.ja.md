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

アドオンのIDにはワイルドカードとして「?」（任意の1文字）「*」（任意のN文字）も使用できます。

## プラグインの管理

例えば「Java(TM) Plug-in ...」のような名前のプラグインを管理する場合、以下のような設定項目を作成します。

    pref("extensions.force-addon-status@clear-code.com.plugins.0.pattern",
         "^Java\(TM\) Plug-in");
    pref("extensions.force-addon-status@clear-code.com.plugins.0.enabledState",
         0);

「.pattern」の値は、プラグイン名に対して適用される、大文字小文字を区別する正規表現です。
これは、プラグインのアドオンとしてのIDがインストールの度に変化するためです。

「.status」の値は以下の意味になります。

  * 0 (常に無効)
  * 1 (クリックして有効化)
  * 2 (常に有効)

