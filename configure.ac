AC_INIT([spasqlqb], m4_esyscmd([./gen_version.sh | tr -d '\n']), [ods@openlinksw.com])
AM_INIT_AUTOMAKE

# --------------------------------------------------------------
# Check for python (vadpacker)
# --------------------------------------------------------------
AM_PATH_PYTHON([2.5])


# --------------------------------------------------------------
# Check for vadpacker as distributed with Virtuoso
# Allow a manual override
# --------------------------------------------------------------
AC_ARG_WITH(
  [vadpacker],
  [AS_HELP_STRING(
    [--with-vadpacker=PATH],
    [Specify the full path to the vadpacker script to use. If not provided configure will search the PATH.])],
  [VADPACKER=${withval}],
  [
    if test [ -f vadpacker/vadpacker.py ]; then
      VADPACKER=`pwd`/vadpacker/vadpacker.py
    fi
  ])
AC_PATH_PROG([VADPACKER], [vadpacker.py],,)
if test "x$VADPACKER" = "x"; then
  AC_MSG_ERROR([cannot find vadpacker.py. Consider using --with-vadpacker=<PATH>.])
fi


# --------------------------------------------------------------
# Allow to specify the installation vad dir
# --------------------------------------------------------------
AC_ARG_WITH(
  [vaddir],
  [AS_HELP_STRING(
    [--with-vaddir=PATH],
    [Specify the full path to where the vad packages should be installed. Defaults to DATADIR/virtuoso/vad.])],
  [vaddir=${withval}],
  [vaddir=$datadir/virtuoso/vad])


# Make all required variables available
AC_SUBST([vaddir])

AC_CONFIG_FILES([Makefile])

AC_OUTPUT

echo ""
echo "Configuration results:"
echo "----------------------"
echo "VAD version:   $PACKAGE_VERSION"
echo "Python:        $PYTHON ($PYTHON_VERSION)"
echo "Vadpacker:     $VADPACKER"
echo ""
