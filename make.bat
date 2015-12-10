setlocal
set appname=force-addon-status

copy makexpi\makexpi.sh .\
bash makexpi.sh -n %appname% -o
del makexpi.sh
endlocal
