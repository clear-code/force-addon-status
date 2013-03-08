setlocal
set appname=force-addon-status

copy buildscript\makexpi.sh .\
bash makexpi.sh -n %appname% -o
del makexpi.sh
endlocal
