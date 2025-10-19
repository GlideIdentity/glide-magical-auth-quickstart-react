#!/bin/sh

##############################################################################
##
##  Gradle start up script for UN*X
##
##############################################################################

# Attempt to set APP_HOME
# Resolve links: $0 may be a link
PRG="$0"
# Need this for relative symlinks.
while [ -h "$PRG" ] ; do
    ls=`ls -ld "$PRG"`
    link=`expr "$ls" : '.*-> \(.*\)$'`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=`dirname "$PRG"`"/$link"
    fi
done
SAVED="`pwd`"
cd "`dirname \"$PRG\"`/" >/dev/null
APP_HOME="`pwd -P`"
cd "$SAVED" >/dev/null

# Use the maximum available, or set MAX_FD != -1 to use that value.
MAX_FD="maximum"

# OS specific support (must be 'true' or 'false').
darwin=false
case "`uname`" in
  Darwin* )
    darwin=true
    ;;
esac

# Determine the Java command to use to start the JVM.
if [ -n "$JAVA_HOME" ] ; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD="java"
fi

# Increase the maximum file descriptors if we can.
if [ "$darwin" = "false" ] ; then
    MAX_FD_LIMIT=`ulimit -H -n`
    if [ $? -eq 0 ] ; then
        if [ "$MAX_FD" = "maximum" -o "$MAX_FD" = "max" ] ; then
            MAX_FD="$MAX_FD_LIMIT"
        fi
        ulimit -n $MAX_FD
        if [ $? -ne 0 ] ; then
            echo "Could not set maximum file descriptor limit: $MAX_FD"
        fi
    else
        echo "Could not query maximum file descriptor limit: $MAX_FD_LIMIT"
    fi
fi

# Check if gradle is installed
if command -v gradle >/dev/null 2>&1; then
    exec gradle "$@"
else
    echo "Gradle is not installed. Please install Gradle to build the Java server."
    echo "Visit https://gradle.org/install/ for installation instructions."
    exit 1
fi 