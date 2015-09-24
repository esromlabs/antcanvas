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
  var step_rate = 0;


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
      if (step_rate) {
        vis_run_state("edge[source='"+edge.from+"'][target='"+edge.to+"'][edge_type='get']", "active_run_get", step_rate/2);
      }
      //noio//
      if (end_node.io && name === end_node.io.selector.substr(1)) {
          console.log("Warning: io node not implemented for get_edge. ", JSON.stringify(end_node.io));
      }
      if (end_node.data) {
		    got_obj[alias] = end_node.data[name];
        if (step_rate) {
          vis_run_state("node[id='"+end_node.id+"']", "active_run_get", step_rate/2);
        }
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

    if (step_rate && guard.result) {
      vis_run_state("edge[source='"+edge.from+"'][target='"+edge.to+"'][edge_type='set']", "active_run_set", step_rate/2);
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
				if (step_rate) {
				  vis_run_state("node[id='"+end_node.id+"']", "active_run_set", step_rate/2);
        }
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
    // first go through only the restrictive guarded flo edges.
    U.each(trans_edges, function restrictive_flo(i, e) {
      var edge = unpack_edge(e);
      var guard = {"result":false};
      var dest_node;
      if (edge.guard && !gone) {
        guard = run_edge_guard(get_result, edge.guard);

        if (guard.result) {
          console.log("trigger transition "+edge.from+" -> "+edge.to);
          //if (step_rate) {
          //  vis_run_state("edge[source='"+edge.from+"'][target='"+edge.to+"']", "active_run_flo", step_rate);
          //}
          //setTimeout(function() {
              //$("body").trigger("edge_" + edge.index);
          //  }, step_rate);
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
            console.log("trigger transition "+edge.from+" -> "+edge.to);
            //if (step_rate) {
            //  vis_run_state("edge[source='"+edge.from+"'][target='"+edge.to+"']", "active_run_flo", step_rate);
            //}
            dest_node = gq.using(g).find({"element":"node", "id":edge.to}).nodes()[0];
            current_node = dest_node;
            return false; // escape the each iterator
          }
        }
      });
    }
  };

  run_node = function() {
    var target_node = current_node;
    var orig_step_rate = step_rate;
    var pause_mode = false;
    // get phase
    var get_data = get_all(target_node.id);
    var this_node;
    var wait = function(milliseconds) {
      console.log("wait() defers transition at node "+target_node.id+" by "+milliseconds);
      get_data.defered_transition = true;
      setTimeout(function() {transition_to(target_node.id, {});}, milliseconds);
    };
    //if (vis_node_selected(target_node.id)) {
    //  pause_mode = true;
    //  step_rate = 5000;
    //}
    //if (step_rate) {
    //  vis_run_state("node[id='"+target_node.id+"']", "active_run_node", step_rate);
    //}
    get_data.defered_transition = false;
    if (target_node.data) {
      get_data = U.extend(get_data, target_node.data);
    }
    // process phase
    if (target_node.process) {
      get_data.wait = wait;
      get_data.target_node_id = target_node.id;
      U.each(target_node.process, function run_proc(i, process) {
        get_data = run_node_process(get_data, process);
      });
    }

    //setTimeout(function() {
    // set phase
    set_all(target_node.id, get_data);
    // transition phase
    if (!get_data.defered_transition) {
      transition_to(target_node.id, get_data);
    }
    //}, step_rate/2);

    step_rate = orig_step_rate;
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

  set_step_rate = function() {
    //step_rate = parseInt($("#run_step_rate").val(), 10) || 0;
    //$('body').trigger('run_step_rate_change', step_rate);
  };

  // pass in a graphlet data structure to be run.
  init_graphlet = function(g) {
    var init_node = gq.using(g).find({"element":"node", "type":"init"}).nodes();
    var start_node = gq.using(g).find({"element":"node", "type":"start"}).nodes();
    glt = g;
    current_node = start_node[0];
    // cancel any previous listeners for a graph_init message.
    //$('body').off('graph_init');
    //set_step_rate();
    if (g.graph && g.graph.template) {
			//$(function() {
			//	$("#graphlet").html(g.graph.template);
			//});
		}
		/*
    U.each(io_nodes, function init_io_node(i, node) {
		  var selector, selector_str;
		  var sel_dom;
		  var event_edges;
		  if (node.parent) {
		    event_edges = gq.using(g).find({"element":"edge", "type":"sub", "from":node.parent}).edges();
		  }
		  else {
		    event_edges = gq.using(g).find({"element":"edge", "type":"sub", "from":node.id}).edges();
		  }

		  if (node.io && node.io.selector) {
		    selector = node.io.selector;
		    // initial sync the nodes data with the IO point
		    sel_dom = $(selector)[0];
		    if (!sel_dom) {
		      if (selector[0] === '#') {
		        selector_str = ' id="'+selector.substr(1)+'"';
		      }
		      if (selector[0] === '.') {
		        selector_str = ' class="'+selector.substr(1)+'"';
		      }
		      $("#graphlet").append('<div ' + selector_str + '>'+selector_str+'</div>');
		    }
		    // initial syncing of DOM and data
		    if (node.data && node.name) {
		      $(selector).val(node.data[node.name]);
		      $(selector).text(node.data[node.name]);
		    }
		    if (!node.data) {node.data = {};}
		  }
	    if (event_edges) {
	      selector = node.io.selector || 'body';
	      //U.each(event_edges, function turn_off_events (i, e) {
	      //  var edge = unpack_edge(e);
	      //  $(selector).off(edge.name);
	      //});
	      U.each(event_edges, function prepare_events (i, e) {
	        var edge = unpack_edge(e);
    			var target_node = gq.using(g).find({"element":"node", "id":edge.to}).nodes()[0];
    			$(selector).on(edge.name, function fire_evt() {
    				// DOM events are mapped to edges. the event source data is transfered to the
    				// target node, then the target node is run by calling run_node().
    				target_node.data = U.extend(target_node.data, node.data);
    				run_node(target_node);
    			});
	      });
	    }
		});
    */
    /*
    U.each(flo_edges, function prepare_flows(i, e) {
      var edge = unpack_edge(e);
			$("body").off("edge_" + edge.index);
			$("body").on("edge_" + edge.index, function fire_flo() {
				var target_node = gq.using(g).find({"element":"node", "id":edge.to}).nodes()[0];
				run_node(target_node);
			});
		});
    */
    console.log("trigger of graph_init event");

    //$('body').trigger('graph_init');
  };

})(U, gq);
