// graphlet run
//
var U = {
  // this.each` from 2.0.3 and supporting helpers
  class2type:{
    "[object Boolean]": "boolean",
    "[object Number]": "number",
    "[object String]": "string",
    "[object Function]": "function",
    "[object Array]": "array",
    "[object Date]": "date",
    "[object RegExp]": "regexp",
    "[object Object]": "object",
    "[object Error]": "error"
  },
  "type": function (obj) {
      if (obj == null) {
          return String(obj);
      }
      // Support: Safari <= 5.1 (functionish RegExp)
      var s = new Object();
      return typeof obj === "object" || typeof obj === "function" ? this.class2type[s.toString.call(obj)] || "object" : typeof obj;
  },
  isArraylike: function (obj) {
    var length = obj.length,
        type = this.type(obj);

    if (obj.nodeType === 1 && length) {
        return true;
    }

    return type === "array" || type !== "function" && (length === 0 || typeof length === "number" && length > 0 && (length - 1) in obj);
  },
  each: function (obj, callback, args) {
      var value, i = 0,
          length = obj.length,
          isArray = this.isArraylike(obj);

      if (args) {
          if (isArray) {
              for (; i < length; i++) {
                  value = callback.apply(obj[i], args);

                  if (value === false) {
                      break;
                  }
              }
          } else {
              for (i in obj) {
                  value = callback.apply(obj[i], args);

                  if (value === false) {
                      break;
                  }
              }
          }

          // A special, fast, case for the most common use of each
      } else {
          if (isArray) {
              for (; i < length; i++) {
                  value = callback.call(obj[i], i, obj[i]);

                  if (value === false) {
                      break;
                  }
              }
          } else {
              for (i in obj) {
                  value = callback.call(obj[i], i, obj[i]);

                  if (value === false) {
                      break;
                  }
              }
          }
      }

      return obj;
  },
  // Deep extend
  // If a key has another object as its value, the first object's value will be combined with the second one during the merge.
  extend: function ( objects ) {
      var extended = {};
      var self = this;
      var merge = function (obj) {
          for (var prop in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                  if ( Object.prototype.toString.call(obj[prop]) === '[object Object]' ) {
                      extended[prop] = self.extend(extended[prop], obj[prop]);
                  }
                  else {
                      extended[prop] = obj[prop];
                  }
              }
          }
      };
      merge(arguments[0]);
      for (var i = 1; i < arguments.length; i++) {
          var obj = arguments[i];
          merge(obj);
      }
      return extended;
  }
};

(function(U, gq) {
  var glt;
  var current_node;

  var unpack_edge = function(e) {
    return {"from":e[0], "to":e[1], "edge_type":e[2], "name":e[3], "guard":e[4], "index":e[5] };
  };

  // get all values from get edges and return as an object
  var get_all = function(id) {
    var got_obj = {};
    var g = glt;
    var get_edges = gq.using(g).find({"element":"edge", "type":"get", "from":id}).edges();

    U.each(get_edges, function get_edge (i, e) {
      var edge = unpack_edge(e);
      var end_node = gq.using(g).find({"element":"node", "id":edge.to}).nodes()[0];
      var name = edge.name || end_node.name;
      // get edges use the "guard" as an "alias"
      var alias = edge.guard || name;
      var selector;
      //noio//
      if (end_node.io && name === end_node.io.selector.substr(1)) {
          console.log("Warning: io node not implemented for get_edge. ", JSON.stringify(end_node.io));
      }
      if (end_node.data && end_node.data[name] !== undefined && (end_node.process === undefined || end_node.process.length === 0)) {
		    got_obj[alias] = end_node.data[name];
	    }
      else {
        got_obj[alias] = fetch(end_node)[name];
      }
    });
    return got_obj;
  };

  var set_1edge = function(e, g, result) {
    var edge = unpack_edge(e);
    var end_node = gq.using(g).find({"element":"node", "id":edge.to}).nodes()[0];
    var start_node = gq.using(g).find({"element":"node", "id":edge.from}).nodes()[0];
    var name = edge.name || end_node.name || start_node.name || "data";
    var guard = {"result":true};

    if (edge.guard) {
      guard = run_edge_guard(result, edge.guard);
    }

    if (guard.result) {
      if (name.charAt(0) === ".") {
        console.log("Warning: . in set edge is not implemented. ", JSON.stringify(edge));
			}
			else {
				if (!end_node.data) { end_node.data = {};}
				if (edge.name === 'push') {
				  end_node.data[end_node.name].push(result[name]);
				}
				else {
				  end_node.data[name] = result[name];
				}
				if (end_node.io && end_node.io.selector) {
          console.log("Warning: io node not implemented for set_edge. ", JSON.stringify(end_node.io));
					//$(end_node.io.selector).text(end_node.data[name]);
					//$(end_node.io.selector).val(end_node.data[name]);
				}
				set_all(edge.to, result);
      }
    }
  };

  var set_all = function(id, result) {
    var g = glt;
    //var from_node = gq.using(g).find({"element":"node", "id":id}).nodes();
    var set_edges = gq.using(g).find({"element":"edge", "type":"set", "from":id}).edges();
    var pub_edges = gq.using(g).find({"element":"edge", "type":"pub", "from":id}).edges();

    U.each(set_edges, function set_edge(i, e) { set_1edge(e, g, result); });
    U.each(pub_edges, function pub_edge(i, e) {
      var edge = unpack_edge(e);
      var end_node = gq.using(g).find({"element":"node", "id":edge.to}).nodes()[0];
      var start_node = gq.using(g).find({"element":"node", "id":id}).nodes()[0];
      console.log("event was not triggered (not implemented) for message " + edge.type);
      //$('body').trigger(edge.type);
    });
  };

  var transition_to = function(id, get_result) {
    var gone = false; // no transition has been found, this boolean is used to stop multiple edges from firing.
    var g = glt;
    var trans_edges = gq.using(g).find({"element":"edge", "type":"flo", "from":id}).edges();
    // first try all restrictive (guarded) flo edges.
    U.each(trans_edges, function restrictive_flo(i, e) {
      var edge = unpack_edge(e);
      var guard = {"result":false};
      var dest_node;
      if (edge.guard && !gone) {
        guard = run_edge_guard(get_result, edge.guard);

        if (guard.result) {
          dest_node = gq.using(g).find({"element":"node", "id":edge.to}).nodes()[0];
          current_node = dest_node;
          gone = true;
          return false; // escape the each iterator
        }
      }
    });
    if (!gone) {
      // secondly go to any non-restrictive flo edges (with no guard)
      U.each(trans_edges, function free_flo(i, e) {
        var edge = unpack_edge(e);
        var guard = {"result":true};
        var dest_node;
        if (!edge.guard & !gone) {
          if (guard.result) {
            dest_node = gq.using(g).find({"element":"node", "id":edge.to}).nodes()[0];
            current_node = dest_node;
            return false; // escape the each iterator
          }
        }
      });
    }
    return current_node;
  };

  var fetch = function(target_node) {
      // get phase
      var get_data = get_all(target_node.id);

      if (target_node.data) {
        get_data = U.extend(get_data, target_node.data);
      }
      // process phase
      if (target_node.process) {
        if (!U.isArraylike(target_node.process)) {
          target_node.process(get_data);
        }
        else {
          U.each(target_node.process, function run_proc(i, process) {
            get_data = run_node_process(get_data, process);
          });
        }
      }

      return get_data;
  };

  run_node = function() {
      var target_node = current_node;
      // get phase
      var get_data = get_all(target_node.id);

      if (target_node.data) {
        get_data = U.extend(get_data, target_node.data);
      }
      // process phase
      if (target_node.process) {
        //get_data.target_node_id = target_node.id;
        if (!get_data.x && get_data.x !== undefined && get_data.x !== 0) {
          alert('Nan');
        }
        if (!U.isArraylike(target_node.process)) {
          target_node.process(get_data);
        }
        else {
          U.each(target_node.process, function run_proc(i, process) {
            get_data = run_node_process(get_data, process);
          });
        }
      }

      // set phase
      set_all(target_node.id, get_data);
      // transition phase
      current_node = transition_to(target_node.id, get_data);
      return current_node;
  };

	// sandbox for functional (saferEval)
	// create our own local versions of window and document with limited functionality
	var run_node_process = function (env, code) {
		// Shadow some sensitive global objects
		var locals = {
			window: {},
			document: {}
		};
		// and mix in the environment
		locals = U.extend(locals, env);

		var createSandbox = function (env, code, locals) {
			var params = []; // the names of local variables
			var args = []; // the local variables

			for (var param in locals) {
				if (locals.hasOwnProperty(param)) {
					args.push(locals[param]);
					params.push(param);
				}
			}

			var context = Array.prototype.concat.call(env, params, code); // create the parameter list for the sandbox
			var sandbox = new (Function.prototype.bind.apply(Function, context))(); // create the sandbox function
			context = Array.prototype.concat.call(env, args); // create the argument list for the sandbox

			return Function.prototype.bind.apply(sandbox, context); // bind the local variables to the sandbox
		};

		// result is the 'this' object for the code
		//var result = {};
		var sandbox = createSandbox(env, code, locals); // create a sandbox

		sandbox(); // call the user code in the sandbox
		return env;
	};

	var run_edge_guard = function (env, code) {
		// Shadow some sensitive global objects
		var locals = {
			window: {},
			document: {}
		};
		// and mix in the environment
		locals = U.extend(locals, env);

		var createSandbox = function (env, code, locals) {
			var params = []; // the names of local variables
			var args = []; // the local variables

			for (var param in locals) {
				if (locals.hasOwnProperty(param)) {
					args.push(locals[param]);
					params.push(param);
				}
			}

			var context = Array.prototype.concat.call(env, params, "this.result = (" + code + ");"); // create the parameter list for the sandbox
			var sandbox = new (Function.prototype.bind.apply(Function, context))(); // create the sandbox function
			context = Array.prototype.concat.call(env, args); // create the argument list for the sandbox

			return Function.prototype.bind.apply(sandbox, context); // bind the local variables to the sandbox
		};

		// result is the 'this' object for the code
		var result = {};
		var sandbox = createSandbox(result, code, locals); // create a sandbox

		sandbox(); // call the user code in the sandbox
		return result;
	};

  // pass in a graphlet data structure to be run.
  init_graphlet = function(g) {
    var init_node = gq.using(g).find({"element":"node", "type":"init"}).nodes();
    var start_node = gq.using(g).find({"element":"node", "type":"start"}).nodes();
    glt = g;
    current_node = start_node[0];
  };

})(U, gq);
