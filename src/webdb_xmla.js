/*
 *   This file is part of the XMLA Explorer project
 *
 *   Copyright (C) 2014-2015 OpenLink Software
 *
 *   This project is free software; you can redistribute it and/or modify it
 *   under the terms of the GNU General Public License as published by the
 *   Free Software Foundation; only version 2 of the License, dated June 1991.
 *
 *   This program is distributed in the hope that it will be useful, but
 *   WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 *   General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License along
 *   with this program; if not, write to the Free Software Foundation, Inc.,
 *   51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */


(function (window){

var $nsXMLALite = function () {
};

$nsXMLALite.prototype = {
  openXMLADatabaseSync : function (url, dsn, cat, uid, pwd, version, creationCallback, timeout) {
    var db = this.openXMLA(url, dsn, cat, uid, pwd, version, true, timeout);
    if (creationCallback) {
      creationCallback.handleEvent(db);
    }
    return db;
  },

  openXMLADatabase : function (url, dsn, cat, uid, pwd, version, creationCallback, timeout) {
    var db = this.openXMLA(url, dsn, cat, uid, pwd, version, false, timeout);
    if (creationCallback) {
      creationCallback.handleEvent(db);
    }
    return db;
  },

  openXMLA : function (_url, _dsn, _cat, _uid, _pwd, version, _sync, _timeout) {
    var _xmla = null;
    var _conn_ver = 0;
    var _rs = null;
    var _err = false;
    var _exception = null;
    var _readonly = false;
    var _isVirtuoso = false;
    var _rtimeout = _timeout?_timeout:60000;

    if (_dsn.length == 0)
      _dsn = "DSN=Local_Instance";
    

    var _options = {
      		async: false,
      		requestTimeout: _rtimeout,
      		url: _url,
      		properties: {
      		  DataSourceInfo: _dsn,
      		  UserName: _uid,
      		  Password: _pwd,
                  Format: Xmla.PROP_FORMAT_TABULAR
      		},
      		restrictions: {}
              };

    if (typeof(_cat) == "string" && _cat.length > 0) {
      _options.properties.Catalog = _cat;
    }

    try {
      _xmla = new Xmla(_options);

      _rs = _xmla.discoverProperties();
      if (_rs == null) {
        throw "Can't connect to "+_dsn;
      }
      while (_rs.hasMoreRows()) {
        if (_rs.fieldVal("PropertyName")=="ProviderName") {
          var s = _rs.fieldVal("Value");
          if (s!==null && s.indexOf("Virtuoso") != -1)
            _isVirtuoso = true;
          break;
        } 
        _rs.next();
      }

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      _rs = _xmla.discoverDBTables({
		restrictions: {
               TABLE_NAME: "NSIODBC_VERSION"
              }});
      if (_err) throw -1;
      var tblver_exists =( _rs.numRows > 0);
      if (!tblver_exists) {
         try {
           _xmla.execute({
                statement: "drop table NSIODBC_VERSION"});
         } catch (ex) {}
         _err = false;
         _xmla.execute({
                statement: "create table NSIODBC_VERSION(VER integer)"});
         if (_err ) {
           if (_exception.code == 4) 
             _readonly = true;
           else
             throw -1; 
         } else {
           _xmla.execute({
                statement: "insert into NSIODBC_VERSION values(0)"});
           if (_err) { 
             _readonly = true; throw -1;
           } else {
             tblver_exists = true;
           }
         }
      }
      if (tblver_exists) {
        _rs = _xmla.execute({
             statement: "select VER from NSIODBC_VERSION"});
//??temp        if (_err) throw -1;
        if (_err) {
          tblver_exists = false;
        }
        else if (_rs.hasMoreRows()) 
          _conn_ver = _rs.fieldVal(_rs.fieldName(0));
      }

      if (typeof(version) == "string" && version.length > 0) {
        var dbver = parseInt(version);
        if (dbver != _conn_ver)
          throw "Wrong version database:"+_conn_ver;
      }
      _options.async = !_sync;
      if (_sync)
        return new $nsDatabaseSync(_options, _conn_ver, tblver_exists, _readonly);
      else
        return new $nsDatabase(_options, _conn_ver, tblver_exists, _readonly);

    } catch (ex) {
      if (ex instanceof Error) 
        throw new $nsSQLException(ex);
      else
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }

    return null;
  },


  discoverDataSources : function (_url) {
    var _xmla = null;
    var _rs;
    var _err = false;
    var _exception = null;

    var _options = {
      		async: false,
      		url: _url,
      		properties: {},
      		restrictions: {}
              };

    try {
      _xmla = new Xmla(_options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      _rs = _xmla.discoverDataSources();
      if (_err) throw -1;

      return new $nsSQLResultSet(_rs);

    } catch (ex) {
      if (ex instanceof Error) 
        throw new $nsSQLException(ex);
      else
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
    return null;
  }

};


function $nsDatabaseSync(options, conn_ver, ver_exists, readonly) {
  this._options = options;
  this._ver_exists = ver_exists;
  this._readonly = readonly;
  this.version = ""+conn_ver;
}

$nsDatabaseSync.prototype = {
  _options: null,
  _ver_exists: false,
  _readonly: false,

  version: "0",

  transaction : function (callback) {
    if (!callback)
      throw "Transaction callback function is null";

    var msc = new $nsSQLTransactionSync(this, this._options);
    if (!msc)
       throw "Error out of Memory";

    try {
//??unsupported XMLA       this._conn.readOnlyMode = false;
       callback.handleEvent(msc);
    } catch (ex) {
       if (ex instanceof Error) 
         ex = $nsSQLException(null, ex.message);
       else
       if (ex instanceof Xmla.Exception)
         ex = new $nsSQLException(ex);

       throw ex;
    } finally {
       delete msc;
    }
  },


  readTransaction : function(callback) {
    if (!callback)
      throw "Transaction callback function is null";

    var msc = new $nsSQLTransactionSync(this, this._options);
    if (!msc)
       throw "Error out of Memory";

    try {
//??unsupported XMLA       this._conn.readOnlyMode = true;
       callback.handleEvent(msc);
    } catch (ex) {
       if (ex instanceof Error) 
         ex = $nsSQLException(null, ex.message);
       else
       if (ex instanceof Xmla.Exception)
         ex = new $nsSQLException(this._exception);

       throw ex;
    } finally {
       delete msc;
    }
  },


  changeVersion : function (oldVersion, newVersion, callback) {
   var oldVer = parseInt(oldVersion);
   var newVer = parseInt(newVersion);

   if (oldVer != this._conn_ver)
     throw "Database version isn't equal connection version";

   var msc = new $nsSQLTransactionSync(this, this._options);
   var _err = false;
   var _exception = null;
   if (!msc)
     throw "Error out of Memory";

   try {
      if (callback)
        callback.handleEvent(msc);

      var _xmla = new Xmla(this._options);
      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
            _exception = eventData.exception;
            _err = true;
          },
          scope: this
      });

      var _query = "update NSIODBC_VERSION set VER="+newVersion;
      _xmla.execute({statement: _query});
      if (_err) throw -1;

      this._conn_ver = newVer;

   } catch (ex) {
     if (ex instanceof Error) 
       ex = $nsSQLException(null, ex.message);
     else
     if (ex == -1)
       throw new $nsSQLException(_exception); 
     else if (ex instanceof Xmla.Exception)
       throw new $nsSQLException(ex); 
     else
       throw ex;
   } finally {
      delete msc;
   }
  }

};


function $nsDatabase(options, conn_ver, ver_exists, readonly) {
  this._options = options;
  this._conn_ver = conn_ver;
  this._ver_exists = ver_exists;
  this._readonly = readonly;
}


$nsDatabase.prototype = {

  _options: null,
  _conn_ver: 0,
  _ver_exists: false,
  _readonly: false,


  get version()  { return ""+this._conn_ver; },

  transaction : function (callback, errorCallback, successCallback) {
    if (!callback)
      throw "Transaction callback function is null";

    var msc = new $nsSQLTransaction(this, this._options, errorCallback, successCallback);
    if (!msc)
       throw "Error out of Memory";

    try {
//??unsupported XMLA       this._conn.readOnlyMode = false;
       callback.handleEvent(msc);
       msc._exec_task();
    } catch (ex) {
       var err = null;
       if (ex instanceof Xmla.Exception)
         err = new $nsSQLError(ex);
       else
         err = new $nsSQLError(null, ex.toString());

       if (errorCallback)
         errorCallback.handleEvent(err);
    } finally {
       delete msc;
    }
  },


  readTransaction : function (callback, errorCallback, successCallback) {
    if (!callback)
      throw "Transaction callback function is null";

    var msc = new $nsSQLTransaction(this, this._options, errorCallback, successCallback);
    if (!msc)
       throw "Error out of Memory";

    try {
//??unsupported XMLA       this._conn.readOnlyMode = true;
       callback.handleEvent(msc);
    } catch (ex) {
       var err = null;
       if (ex instanceof Xmla.Exception)
         err = new $nsSQLError(ex);
       else
         err = new $nsSQLError(null, ex.toString());

       if (errorCallback)
         errorCallback.handleEvent(err);
    } finally {
       delete msc;
//??unsupported XMLA          this._self._conn.readOnlyMode = false;
    }
  },
  

  changeVersion : function (oldVersion, newVersion, callback, errorCallback, successCallback) {
    var oldVer = parseInt(oldVersion);
    var newVer = parseInt(newVersion);

    if (oldVer != this._conn_ver)
      throw "Database version isn't equal connection version";

    var hSuccess = {
      handleEvent: function() { 
        var _err = false;
        var _exception = null;
        try{
          var _xmla = new Xmla(this._options);
          _xmla.addListener({
            events: Xmla.EVENT_ERROR,
            handler: function(eventName, eventData, xmla){
                _exception = eventData.exception;
                _err = true;
            },
            scope: this
          });

          var _query = "update NSIODBC_VERSION set VER="+newVersion;
          _xmla.execute({statement: _query,
                     async:false });
          if (_err) {
            if (errorCallback)
              errorCallback.handleEvent(new $nsSQLError(_exception));
          } else {
            this._self._conn_ver = newVer;
            if (successCallback)
              successCallback.handleEvent();
          }
        } catch (ex) {
          var err = null;
          if (ex instanceof Xmla.Exception)
            err = new $nsSQLError(ex);
          else
            err = new $nsSQLError(null, ex.toString());

          if (errorCallback)
            errorCallback.handleEvent(err);
        }
      }
    };

    var msc = new $nsSQLTransaction(this, this._options, errorCallback, hSuccess);
    if (!msc)
       throw "Error out of Memory";

    try {
//??unsupported XMLA       this._conn.readOnlyMode = false;
       if (callback)
         callback.handleEvent(msc);
       msc._exec_task();
    } catch (ex) {
       if (errorCallback)
         errorCallback.handleEvent(new $nsSQLError(null, ex.toString()));
    } finally {
       delete msc;
    }
  },

};


function $nsSQLException(ex) {
  if (typeof(ex.code)!="undefined" && ex.code) 
    this.code = ex.code;
  else
    this.code = -1;
  this.message = ex.message;
  this.state = "HY000"; //??TODO handle.errorState;
}

$nsSQLException.prototype = {
  code: 0,
  message: null,
  state: null,

  toString : function() {
    return this.message;
  }
};



function $nsSQLError(ex, message) {
  if (ex != null) {
    this._code = ex.code;
    this._message = ex.message;
    this._state = "[]"; //??TODO handle.errorState;
  } else {
    this._code = -1;
    this._message = message;
    this._state = "HY000";
  }
}

$nsSQLError.prototype = {

  _code: 0,
  _message: null,
  _state: null,

  get code()     { return this._code; },
  get message()  { return this._message; },
  get state()    { return this._state; },

  toString : function() {
    return this._message;
  },
};



function $substParams(query, args, arg_len) {
  var ch;
  var id=0;
  var i=0;
  var qlen = query.length;
  var buf=[];
  while(i < qlen) {
    ch = query.charAt(i++);
    if (ch == '?') {
      if (id < arg_len) {
        var par = args[id++];
        if (typeof(par) == "string") {
          buf.push("'");
          buf.push(par.replace(new RegExp("'",'g'),"\\'").replace(new RegExp("\"",'g'),"\\\""));
          buf.push("'")
        } else if (par === null){
          buf.push("null");
        } else {
          buf.push(par);
        }
      } else {
        buf.push(ch);
      }
    } else if (ch == '"' || ch == '\'') {
      buf.push(ch);
      while(i < qlen) {
        var c = query.charAt(i++);
        buf.push(c);
        if (c == ch)
          break;
      }
    } else {
      buf.push(ch);
    }
  }
  return buf.join("");
}



function $nsSQLTransactionSync(db, options) {
  this._db = db;
  this._options = options;
}

$nsSQLTransactionSync.prototype = {

  _db: null,
  _options: null,

  executeSql : function (sqlStatement, arguments) {
    var _err = false;
    var _exception = null;
    try {
      var _xmla = new Xmla(this._options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      var arg_len  = (arguments != null && typeof(arguments)!="undefined" ? arguments.length: 0);
      var query;
      if (arg_len > 0)
        query = $substParams(sqlStatement, arguments, arg_len);
      else
        query = sqlStatement;

      var _rs = _xmla.execute({statement: query});
      if (_err) throw -1;

      return new $nsSQLResultSet(_rs);

    } catch (ex) {
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },

  getCatalogs : function () {
    var _err = false;
    var _exception = null;
    try {
      var _xmla = new Xmla(this._options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      var _rs = _xmla.discoverDBCatalogs();
      if (_err) throw -1;

      return new $nsSQLResultSet(_rs);

    } catch (ex) {
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },

  getTables : function (catalog, schema, table, tableType) {
    var _err = false;
    var _exception = null;
    try {
      var _xmla = new Xmla(this._options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      catalog = (catalog===null?"":catalog);
      schema = (schema===null?"":schema);
      table = (table===null?"":table);
      tableType = (tableType===null?"":tableType);
      var _rs = _xmla.discoverDBTables({
      			restrictions: {
      		 	 	TABLE_CATALOG: catalog,
      		  		TABLE_SCHEMA: schema,
      		  		TABLE_NAME: table,
                  		TABLE_TYPE: tableType
      			}});
      if (_err) throw -1;

      return new $nsSQLResultSet(_rs);

    } catch (ex) {
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },

  getColumns : function (catalog, schema, table, column) {
    var _err = false;
    var _exception = null;
    try {
      var _xmla = new Xmla(this._options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      catalog = (catalog===null?"":catalog);
      schema = (schema===null?"":schema);
      table = (table===null?"":table);
      column = (column===null?"":column);
      var _rs = _xmla.discoverDBColumns({
      			restrictions: {
      		 	 	TABLE_CATALOG: catalog,
      		  		TABLE_SCHEMA: schema,
      		  		TABLE_NAME: table,
                  		COLUMN_NAME: column
      			}});
      if (_err) throw -1;

      return new $nsSQLResultSet(_rs);

    } catch (ex) {
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },
  
  getPrimaryKeys : function (catalog, schema, table) {
    var _err = false;
    var _exception = null;
    try {
      var _xmla = new Xmla(this._options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      catalog = (catalog===null?"":catalog);
      schema = (schema===null?"":schema);
      table = (table===null?"":table);
      var _rs = _xmla.discoverDBPrimaryKeys({
      			restrictions: {
      		 	 	TABLE_CATALOG: catalog,
      		  		TABLE_SCHEMA: schema,
      		  		TABLE_NAME: table
      			}});
      if (_err) throw -1;

      return new $nsSQLResultSet(_rs);

    } catch (ex) {
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },

  getForeignKeys : function (pcatalog, pschema, ptable, 
  			fcatalog, fschema, ftable) {
    var _err = false;
    var _exception = null;
    try {
      var _xmla = new Xmla(this._options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      pcatalog = (pcatalog===null?"":pcatalog);
      pschema = (pschema===null?"":pschema);
      ptable = (ptable===null?"":ptable);
      fcatalog = (fcatalog===null?"":fcatalog);
      fschema = (fschema===null?"":fschema);
      ftable = (ftable===null?"":ftable);
      var _rs = _xmla.discoverDBForeignKeys({
      			restrictions: {
      		 	 	PK_TABLE_CATALOG: pcatalog,
      		  		PK_TABLE_SCHEMA: pschema,
      		  		PK_TABLE_NAME: ptable,
      		 	 	FK_TABLE_CATALOG: fcatalog,
      		  		FK_TABLE_SCHEMA: fschema,
      		  		FK_TABLE_NAME: ftable
      			}});
      if (_err) throw -1;

      return new $nsSQLResultSet(_rs);

    } catch (ex) {
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },

  getTypeInfo : function (dataType) {
    var _err = false;
    var _exception = null;
    try {
      var _xmla = new Xmla(this._options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
             _exception = eventData.exception;
             _err = true;
          },
          scope: this
      });

      dataType = (dataType===null?0:dataType);
      var _rs = _xmla.discoverDBProviderTypes({
      			restrictions: {
      		 	 	DATA_TYPE: dataType
      			}});
      if (_err) throw -1;

      return new $nsSQLResultSet(_rs);

    } catch (ex) {
      if (ex == -1)
        throw new $nsSQLException(_exception); 
      else if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },

  getProcedures : function (catalog, schema, procedure) {
    return new $nsSQLResultSetEmpty();
  },

  getProcedureColumns : function (catalog, schema, procedure, column) {
    return new $nsSQLResultSetEmpty();
  }

};


function $nsSQLTransaction(db, options, errorCallback, successCallback) {
  this._db = db;
  this._options = options;
  this._tasks = [];
  this._executed = false;
  this._errorCallback = errorCallback;
  this._successCallback = successCallback;
}

$nsSQLTransaction.prototype = {

  _db: null,
  _options: null,
  _lastError: null,

  executeSql : function (sqlStatement, arguments, callback, errorCallback) {
    var task = {cmd:"exec", 
               args:{sql:sqlStatement, args:arguments}, 
    	         cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  getCatalogs : function (callback, errorCallback) {
    var task = {cmd:"cats",
               args: null,  
                 cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  getTables : function (catalog, schema, table, tableType, callback, errorCallback) {
    catalog = (catalog===null?"":catalog);
    schema = (schema===null?"":schema);
    table = (table===null?"":table);
    tableType = (tableType===null?"":tableType);

    var task = {cmd:"tbls", 
    	       args:{ cat:catalog, sch:schema, tab:table, tabType:tableType}, 
                 cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  getColumns : function (catalog, schema, table, column, callback, errorCallback) {
    catalog = (catalog===null?"":catalog);
    schema = (schema===null?"":schema);
    table = (table===null?"":table);
    column = (column===null?"":column);

    var task = {cmd:"cols",
               args:{ cat:catalog, sch:schema, tab:table, col:column}, 
                 cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  getPrimaryKeys : function (catalog, schema, table, callback, errorCallback) {
    catalog = (catalog===null?"":catalog);
    schema = (schema===null?"":schema);
    table = (table===null?"":table);

    var task = {cmd:"pkeys",
    	       args:{ cat:catalog, sch:schema, tab:table}, 
                 cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  getForeignKeys : function (pcatalog, pschema, ptable, 
  			fcatalog, fschema, ftable, callback, errorCallback) {
    pcatalog = (pcatalog===null?"":pcatalog);
    pschema = (pschema===null?"":pschema);
    ptable = (ptable===null?"":ptable);
    fcatalog = (fcatalog===null?"":fcatalog);
    fschema = (fschema===null?"":fschema);
    ftable = (ftable===null?"":ftable);

    var task = {cmd:"fkeys",
               args:{ pcat:pcatalog, psch:pschema, ptab:ptable,
                      fcat:fcatalog, fsch:fschema, ftab:ftable}, 
                 cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  getTypeInfo : function (dataType, callback, errorCallback) {
    dataType = (dataType===null?0:dataType);

    var task = {cmd:"typeInfo", args:argumets, 
               args:{ dataType:dataType}, 
                 cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  getProcedures : function (catalog, schema, procedure, callback, errorCallback) {
    var task = {cmd:"procs", args:argumets, 
               args:{ cat:catalog, sch:schema, tab:table}, 
                 cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  getProcedureColumns : function (catalog, schema, procedure, column, callback, errorCallback) {
    var task = {cmd:"pcols", args:argumets, 
               args:{ cat:catalog, sch:schema, proc:procedure, col:column}, 
                 cb:callback, ecb:errorCallback };

    if (this._executed)
      this._tasks.unshift(task);
    else
      this._tasks.push(task);
  },

  _exec_task : function () {
    var task = this._tasks.shift();
    var query = null;

    this._executed = true;

    if (!task) {
      if (this._successCallback)
        this._successCallback.handleEvent();
      return;
    }

    try {

      if (task.cmd === "exec") {
        var arg_len  = (task.args.args != null && typeof(task.args.args)!="undefined" ? task.args.args.length: 0);
        if (arg_len > 0)
          query = $substParams(task.args.sql, task.args.args, arg_len);
        else
          query = task.args.sql;
      }
    
      var _xmla = new Xmla(this._options);

      _xmla.addListener({
          events: Xmla.EVENT_ERROR,
          handler: function(eventName, eventData, xmla){
          },
          scope: this
      });

      switch(task.cmd) {
        case "exec": 
      	  _xmla.execute({statement: query,
      	  		     async:true,
      	  		 success:function(xmla, options, response){
      	  		   if (task.cb) {
      	  		     var result = new $nsSQLResultSet(response);
            		     task.cb.handleEvent(this, result);
      	  		   }
      	  		   this._exec_task();
      	  		 },
      	  		 error:function(xmla, request, exception){
      	  		   var ret = true;
      	  		   var err = null;
      	  		   if (task.ecb) {
      	  		     err = new $nsSQLError(exception);
      	  		     ret = task.ecb.handleEvent(this, err);
      	  		   }
      	  		   if (ret && err!=null) {
      	  		     this._tasks = [];
      	  		     if (this._errorCallback)
      	  		       this._errorCallback.handleEvent(err);
      	  		   }
      	  		   if (!ret)
      	  		     this._exec_task();
      	  		 }, 
      	  		 scope: this
      	  		});
          break;
        case "cats":
          _xmla.discoverDBCatalogs({
      	  		   async:true,
      	  		 success:function(xmla, options, response){
      	  		   if (task.cb) {
      	  		     var result = new $nsSQLResultSet(response);
            		     task.cb.handleEvent(this, result);
      	  		   }
      	  		   this._exec_task();
      	  		 },
      	  		 error:function(xmla, request, exception){
      	  		   var ret = true;
      	  		   var err = null;
      	  		   if (task.ecb) {
      	  		     err = new $nsSQLError(exception);
      	  		     ret = task.ecb.handleEvent(this, err);
      	  		   }
      	  		   if (ret && err!=null) {
      	  		     this._tasks = [];
      	  		     if (this._errorCallback)
      	  		       this._errorCallback.handleEvent(err);
      	  		   }
      	  		   if (!ret)
      	  		     this._exec_task();
      	  		 }, 
      	  		 scope: this
      	  		});
          break;
        case "tbls":
          _xmla.discoverDBTables({
      			 restrictions: {
      		 	 	TABLE_CATALOG: task.args.cat,
      		  		TABLE_SCHEMA: task.args.sch,
      		  		TABLE_NAME: task.args.tab,
                  		TABLE_TYPE: task.args.tabType
      			 },
      	  		 async:true,
      	  		 success:function(xmla, options, response){
      	  		   if (task.cb) {
      	  		     var result = new $nsSQLResultSet(response);
            		     task.cb.handleEvent(this, result);
      	  		   }
      	  		   this._exec_task();
      	  		 },
      	  		 error:function(xmla, request, exception){
      	  		   var ret = true;
      	  		   var err = null;
      	  		   if (task.ecb) {
      	  		     err = new $nsSQLError(exception);
      	  		     ret = task.ecb.handleEvent(this, err);
      	  		   }
      	  		   if (ret && err!=null) {
      	  		     this._tasks = [];
      	  		     if (this._errorCallback)
      	  		       this._errorCallback.handleEvent(err);
      	  		   }
      	  		   if (!ret)
      	  		     this._exec_task();
      	  		 }, 
      	  		 scope: this
      			});

          break;
        case "cols":
          _xmla.discoverDBColumns({
      			restrictions: {
      		 	 	TABLE_CATALOG: task.args.cat,
      		  		TABLE_SCHEMA: task.args.sch,
      		  		TABLE_NAME: task.args.tab,
                  		COLUMN_NAME: task.args.col
      			},
      	  		 async:true,
      	  		 success:function(xmla, options, response){
      	  		   if (task.cb) {
      	  		     var result = new $nsSQLResultSet(response);
            		     task.cb.handleEvent(this, result);
      	  		   }
      	  		   this._exec_task();
      	  		 },
      	  		 error:function(xmla, request, exception){
      	  		   var ret = true;
      	  		   var err = null;
      	  		   if (task.ecb) {
      	  		     err = new $nsSQLError(exception);
      	  		     ret = task.ecb.handleEvent(this, err);
      	  		   }
      	  		   if (ret && err!=null) {
      	  		     this._tasks = [];
      	  		     if (this._errorCallback)
      	  		       this._errorCallback.handleEvent(err);
      	  		   }
      	  		   if (!ret)
      	  		     this._exec_task();
      	  		 }, 
      	  		 scope: this
      			});
          break;
        case "pkeys":
          _xmla.discoverDBPrimaryKeys({
      			restrictions: {
      		 	 	TABLE_CATALOG: task.args.cat,
      		  		TABLE_SCHEMA: task.args.sch,
      		  		TABLE_NAME: task.args.tab
      			},
      	  		 async:true,
      	  		 success:function(xmla, options, response){
      	  		   if (task.cb) {
      	  		     var result = new $nsSQLResultSet(response);
            		     task.cb.handleEvent(this, result);
      	  		   }
      	  		   this._exec_task();
      	  		 },
      	  		 error:function(xmla, request, exception){
      	  		   var ret = true;
      	  		   var err = null;
      	  		   if (task.ecb) {
      	  		     err = new $nsSQLError(exception);
      	  		     ret = task.ecb.handleEvent(this, err);
      	  		   }
      	  		   if (ret && err!=null) {
      	  		     this._tasks = [];
      	  		     if (this._errorCallback)
      	  		       this._errorCallback.handleEvent(err);
      	  		   }
      	  		   if (!ret)
      	  		     this._exec_task();
      	  		 }, 
      	  		 scope: this
      			});
          break;
        case "fkeys":
          _xmla.discoverDBForeignKeys({
      			restrictions: {
      		 	 	PK_TABLE_CATALOG: task.args.pcat,
      		  		PK_TABLE_SCHEMA: task.args.psch,
      		  		PK_TABLE_NAME: task.args.ptab,
      		 	 	FK_TABLE_CATALOG: task.args.fcat,
      		  		FK_TABLE_SCHEMA: task.args.fsch,
      		  		FK_TABLE_NAME: task.args.ftab
      			},
      	  		 async:true,
      	  		 success:function(xmla, options, response){
      	  		   if (task.cb) {
      	  		     var result = new $nsSQLResultSet(response);
            		     task.cb.handleEvent(this, result);
      	  		   }
      	  		   this._exec_task();
      	  		 },
      	  		 error:function(xmla, request, exception){
      	  		   var ret = true;
      	  		   var err = null;
      	  		   if (task.ecb) {
      	  		     err = new $nsSQLError(exception);
      	  		     ret = task.ecb.handleEvent(this, err);
      	  		   }
      	  		   if (ret && err!=null) {
      	  		     this._tasks = [];
      	  		     if (this._errorCallback)
      	  		       this._errorCallback.handleEvent(err);
      	  		   }
      	  		   if (!ret)
      	  		     this._exec_task();
      	  		 }, 
      	  		 scope: this
      			});
          break;
        case "typeInfo":
          _xmla.discoverDBProviderTypes({
      			restrictions: {
      		 	 	DATA_TYPE: task.args.dataType
      			},
      	  		 async:true,
      	  		 success:function(xmla, options, response){
      	  		   if (task.cb) {
      	  		     var result = new $nsSQLResultSet(response);
            		     task.cb.handleEvent(this, result);
      	  		   }
      	  		   this._exec_task();
      	  		 },
      	  		 error:function(xmla, request, exception){
      	  		   var ret = true;
      	  		   var err = null;
      	  		   if (task.ecb) {
      	  		     err = new $nsSQLError(exception);
      	  		     ret = task.ecb.handleEvent(this, err);
      	  		   }
      	  		   if (ret && err!=null) {
      	  		     this._tasks = [];
      	  		     if (this._errorCallback)
      	  		       this._errorCallback.handleEvent(err);
      	  		   }
      	  		   if (!ret)
      	  		     this._exec_task();
      	  		 }, 
      	  		 scope: this
      			});
          break;
        case "procs":
          if (task.cb) {
            var result = new $nsSQLResultSetEmpty();
            task.cb.handleEvent(this, result);
          }
      	  this._exec_task();
          break;
        case "pcols":
          if (task.cb) {
            var result = new $nsSQLResultSetEmpty();
            task.cb.handleEvent(this, result);
          }
      	  this._exec_task();
          break;
      }

    } catch (ex) {
      var ret = true;
      var err = null;
      
      if (ex instanceof Xmla.Exception)
        err = new $nsSQLError(ex); 
      else
        err = new $nsSQLError(null, ex.toString());

      if (task.ecb) {
        err = new $nsSQLError(ex);
        ret = task.ecb.handleEvent(this, err);
      }

      if (ret && err!=null) {
        this._tasks = [];
        if (this._errorCallback)
          this._errorCallback.handleEvent(err);
      }
      if (!ret)
        this._exec_task();
    }
  },

};




function $nsSQLResultSet(rs) {
  this.rows = new $nsSQLResultSetRowList(rs);
  this.metaData = new $nsSQLResultSetMetaData(rs);
}

$nsSQLResultSet.prototype = {
  insertId: 0,
  rowsAffected: -1,
  rows: null,
  metaData: null

};


function $nsSQLResultSetEmpty() {
  this.rows = new $nsSQLResultSetRowListEmpty();
  this.metaData = new $nsSQLResultSetMetaDataEmpty();
}

$nsSQLResultSetEmpty.prototype = {
  insertId: 0,
  rowsAffected: -1,
  rows: null,
  metaData: null

};


function $nsSQLResultSetRowList(rs) {
  this.length = rs.rowCount();
  this._data=[];

  if (this.length > 0) {
    try {
      var count = rs.fieldCount();
      var flds = rs.getFields();
      var id = 0;

      while(rs.hasMoreRows()) {
        var row = new $nsValue();

        for(var i=0; i < count; i++)
          row[flds[i].name] = rs.fieldVal(flds[i].name);

        this._data[id] = row;
        rs.next();
        id++;
      }
      this.length = id;
    } catch (ex) {
      if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  }
}

$nsSQLResultSetRowList.prototype = {

  length : 0,
  _data: null,

  item : function(index) {
    if (index > this.length)
      return null;
    return this._data[index];
  }

};


function $nsSQLResultSetRowListEmpty() {
}

$nsSQLResultSetRowListEmpty.prototype = {

  length: 0,
  item : null
};


function $nsValue() {
}



function $nsSQLResultSetMetaData(rs) {
  this.columnCount = rs.fieldCount();
  this._rs = rs;
}


$nsSQLResultSetMetaData.prototype = {

  _rs: null,
  columnCount: 0,

  getColumnType : function (index) {
    try {
      var name = this._rs.fieldName(index);
      return this._rs.fieldDef(name).type;
    } catch (ex) {
      if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },

  getColumnName : function (index) {
    try {
      return this._rs.fieldName(index);
    } catch (ex) {
      if (ex instanceof Xmla.Exception)
        throw new $nsSQLException(ex); 
      else
        throw ex;
    }
  },

  isNullable : function(index) {
    return true;
  }

};


function $nsSQLResultSetMetaDataEmpty() {
}

$nsSQLResultSetMetaDataEmpty.prototype = {

  columnCount : 0,
  getColumnType : function (index) { return null; },
  getColumnName : function (index) { return null; },
  isNullable : function(index) { return true; }
};

window.XMLALite = new $nsXMLALite();

})(window);


