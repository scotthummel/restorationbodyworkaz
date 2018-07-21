(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Service for sending network requests.
 */

var xhr = require('./lib/xhr');
var jsonp = require('./lib/jsonp');
var Promise = require('./lib/promise');

module.exports = function (_) {

    var originUrl = _.url.parse(location.href);
    var jsonType = {'Content-Type': 'application/json;charset=utf-8'};

    function Http(url, options) {

        var promise;

        if (_.isPlainObject(url)) {
            options = url;
            url = '';
        }

        options = _.extend({url: url}, options);
        options = _.extend(true, {},
            Http.options, this.options, options
        );

        if (options.crossOrigin === null) {
            options.crossOrigin = crossOrigin(options.url);
        }

        options.method = options.method.toUpperCase();
        options.headers = _.extend({}, Http.headers.common,
            !options.crossOrigin ? Http.headers.custom : {},
            Http.headers[options.method.toLowerCase()],
            options.headers
        );

        if (_.isPlainObject(options.data) && /^(GET|JSONP)$/i.test(options.method)) {
            _.extend(options.params, options.data);
            delete options.data;
        }

        if (options.emulateHTTP && !options.crossOrigin && /^(PUT|PATCH|DELETE)$/i.test(options.method)) {
            options.headers['X-HTTP-Method-Override'] = options.method;
            options.method = 'POST';
        }

        if (options.emulateJSON && _.isPlainObject(options.data)) {
            options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            options.data = _.url.params(options.data);
        }

        if (_.isObject(options.data) && /FormData/i.test(options.data.toString())) {
            delete options.headers['Content-Type'];
        }

        if (_.isPlainObject(options.data)) {
            options.data = JSON.stringify(options.data);
        }

        promise = (options.method == 'JSONP' ? jsonp : xhr).call(this.vm, _, options);
        promise = extendPromise(promise.then(transformResponse, transformResponse), this.vm);

        if (options.success) {
            promise = promise.success(options.success);
        }

        if (options.error) {
            promise = promise.error(options.error);
        }

        return promise;
    }

    function extendPromise(promise, vm) {

        promise.success = function (fn) {

            return extendPromise(promise.then(function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            }), vm);

        };

        promise.error = function (fn) {

            return extendPromise(promise.then(undefined, function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            }), vm);

        };

        promise.always = function (fn) {

            var cb = function (response) {
                return fn.call(vm, response.data, response.status, response) || response;
            };

            return extendPromise(promise.then(cb, cb), vm);
        };

        return promise;
    }

    function transformResponse(response) {

        try {
            response.data = JSON.parse(response.responseText);
        } catch (e) {
            response.data = response.responseText;
        }

        return response.ok ? response : Promise.reject(response);
    }

    function crossOrigin(url) {

        var requestUrl = _.url.parse(url);

        return (requestUrl.protocol !== originUrl.protocol || requestUrl.host !== originUrl.host);
    }

    Http.options = {
        method: 'get',
        params: {},
        data: '',
        xhr: null,
        jsonp: 'callback',
        beforeSend: null,
        crossOrigin: null,
        emulateHTTP: false,
        emulateJSON: false
    };

    Http.headers = {
        put: jsonType,
        post: jsonType,
        patch: jsonType,
        delete: jsonType,
        common: {'Accept': 'application/json, text/plain, */*'},
        custom: {'X-Requested-With': 'XMLHttpRequest'}
    };

    ['get', 'put', 'post', 'patch', 'delete', 'jsonp'].forEach(function (method) {

        Http[method] = function (url, data, success, options) {

            if (_.isFunction(data)) {
                options = success;
                success = data;
                data = undefined;
            }

            return this(url, _.extend({method: method, data: data, success: success}, options));
        };
    });

    return _.http = Http;
};

},{"./lib/jsonp":3,"./lib/promise":4,"./lib/xhr":6}],2:[function(require,module,exports){
/**
 * Install plugin.
 */

function install(Vue) {

    var _ = require('./lib/util')(Vue);

    Vue.url = require('./url')(_);
    Vue.http = require('./http')(_);
    Vue.resource = require('./resource')(_);

    Object.defineProperties(Vue.prototype, {

        $url: {
            get: function () {
                return this._url || (this._url = _.options(Vue.url, this, this.$options.url));
            }
        },

        $http: {
            get: function () {
                return this._http || (this._http = _.options(Vue.http, this, this.$options.http));
            }
        },

        $resource: {
            get: function () {
                return Vue.resource.bind(this);
            }
        }

    });
}

if (window.Vue) {
    Vue.use(install);
}

module.exports = install;
},{"./http":1,"./lib/util":5,"./resource":7,"./url":8}],3:[function(require,module,exports){
/**
 * JSONP request.
 */

var Promise = require('./promise');

module.exports = function (_, options) {

    var callback = '_jsonp' + Math.random().toString(36).substr(2), response = {}, script, body;

    options.params[options.jsonp] = callback;

    if (_.isFunction(options.beforeSend)) {
        options.beforeSend.call(this, {}, options);
    }

    return new Promise(function (resolve, reject) {

        script = document.createElement('script');
        script.src = _.url(options);
        script.type = 'text/javascript';
        script.async = true;

        window[callback] = function (data) {
            body = data;
        };

        var handler = function (event) {

            delete window[callback];
            document.body.removeChild(script);

            if (event.type === 'load' && !body) {
                event.type = 'error';
            }

            response.ok = event.type !== 'error';
            response.status = response.ok ? 200 : 404;
            response.responseText = body ? body : event.type;

            (response.ok ? resolve : reject)(response);
        };

        script.onload = handler;
        script.onerror = handler;

        document.body.appendChild(script);
    });

};

},{"./promise":4}],4:[function(require,module,exports){
/**
 * Promises/A+ polyfill v1.1.0 (https://github.com/bramstein/promis)
 */

var RESOLVED = 0;
var REJECTED = 1;
var PENDING  = 2;

function Promise(executor) {

    this.state = PENDING;
    this.value = undefined;
    this.deferred = [];

    var promise = this;

    try {
        executor(function (x) {
            promise.resolve(x);
        }, function (r) {
            promise.reject(r);
        });
    } catch (e) {
        promise.reject(e);
    }
}

Promise.reject = function (r) {
    return new Promise(function (resolve, reject) {
        reject(r);
    });
};

Promise.resolve = function (x) {
    return new Promise(function (resolve, reject) {
        resolve(x);
    });
};

Promise.all = function all(iterable) {
    return new Promise(function (resolve, reject) {
        var count = 0,
            result = [];

        if (iterable.length === 0) {
            resolve(result);
        }

        function resolver(i) {
            return function (x) {
                result[i] = x;
                count += 1;

                if (count === iterable.length) {
                    resolve(result);
                }
            };
        }

        for (var i = 0; i < iterable.length; i += 1) {
            iterable[i].then(resolver(i), reject);
        }
    });
};

Promise.race = function race(iterable) {
    return new Promise(function (resolve, reject) {
        for (var i = 0; i < iterable.length; i += 1) {
            iterable[i].then(resolve, reject);
        }
    });
};

var p = Promise.prototype;

p.resolve = function resolve(x) {
    var promise = this;

    if (promise.state === PENDING) {
        if (x === promise) {
            throw new TypeError('Promise settled with itself.');
        }

        var called = false;

        try {
            var then = x && x['then'];

            if (x !== null && typeof x === 'object' && typeof then === 'function') {
                then.call(x, function (x) {
                    if (!called) {
                        promise.resolve(x);
                    }
                    called = true;

                }, function (r) {
                    if (!called) {
                        promise.reject(r);
                    }
                    called = true;
                });
                return;
            }
        } catch (e) {
            if (!called) {
                promise.reject(e);
            }
            return;
        }
        promise.state = RESOLVED;
        promise.value = x;
        promise.notify();
    }
};

p.reject = function reject(reason) {
    var promise = this;

    if (promise.state === PENDING) {
        if (reason === promise) {
            throw new TypeError('Promise settled with itself.');
        }

        promise.state = REJECTED;
        promise.value = reason;
        promise.notify();
    }
};

p.notify = function notify() {
    var promise = this;

    async(function () {
        if (promise.state !== PENDING) {
            while (promise.deferred.length) {
                var deferred = promise.deferred.shift(),
                    onResolved = deferred[0],
                    onRejected = deferred[1],
                    resolve = deferred[2],
                    reject = deferred[3];

                try {
                    if (promise.state === RESOLVED) {
                        if (typeof onResolved === 'function') {
                            resolve(onResolved.call(undefined, promise.value));
                        } else {
                            resolve(promise.value);
                        }
                    } else if (promise.state === REJECTED) {
                        if (typeof onRejected === 'function') {
                            resolve(onRejected.call(undefined, promise.value));
                        } else {
                            reject(promise.value);
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            }
        }
    });
};

p.catch = function (onRejected) {
    return this.then(undefined, onRejected);
};

p.then = function then(onResolved, onRejected) {
    var promise = this;

    return new Promise(function (resolve, reject) {
        promise.deferred.push([onResolved, onRejected, resolve, reject]);
        promise.notify();
    });
};

var queue = [];
var async = function (callback) {
    queue.push(callback);

    if (queue.length === 1) {
        async.async();
    }
};

async.run = function () {
    while (queue.length) {
        queue[0]();
        queue.shift();
    }
};

if (window.MutationObserver) {
    var el = document.createElement('div');
    var mo = new MutationObserver(async.run);

    mo.observe(el, {
        attributes: true
    });

    async.async = function () {
        el.setAttribute("x", 0);
    };
} else {
    async.async = function () {
        setTimeout(async.run);
    };
}

module.exports = window.Promise || Promise;

},{}],5:[function(require,module,exports){
/**
 * Utility functions.
 */

module.exports = function (Vue) {

    var _ = Vue.util.extend({}, Vue.util);

    _.isString = function (value) {
        return typeof value === 'string';
    };

    _.isFunction = function (value) {
        return typeof value === 'function';
    };

    _.options = function (fn, obj, options) {

        options = options || {};

        if (_.isFunction(options)) {
            options = options.call(obj);
        }

        return _.extend(fn.bind({vm: obj, options: options}), fn, {options: options});
    };

    _.each = function (obj, iterator) {

        var i, key;

        if (typeof obj.length == 'number') {
            for (i = 0; i < obj.length; i++) {
                iterator.call(obj[i], obj[i], i);
            }
        } else if (_.isObject(obj)) {
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    iterator.call(obj[key], obj[key], key);
                }
            }
        }

        return obj;
    };

    _.extend = function (target) {

        var array = [], args = array.slice.call(arguments, 1), deep;

        if (typeof target == 'boolean') {
            deep = target;
            target = args.shift();
        }

        args.forEach(function (arg) {
            extend(target, arg, deep);
        });

        return target;
    };

    function extend(target, source, deep) {
        for (var key in source) {
            if (deep && (_.isPlainObject(source[key]) || _.isArray(source[key]))) {
                if (_.isPlainObject(source[key]) && !_.isPlainObject(target[key])) {
                    target[key] = {};
                }
                if (_.isArray(source[key]) && !_.isArray(target[key])) {
                    target[key] = [];
                }
                extend(target[key], source[key], deep);
            } else if (source[key] !== undefined) {
                target[key] = source[key];
            }
        }
    }

    return _;
};

},{}],6:[function(require,module,exports){
/**
 * XMLHttp request.
 */

var Promise = require('./promise');
var XDomain = window.XDomainRequest;

module.exports = function (_, options) {

    var request = new XMLHttpRequest(), promise;

    if (XDomain && options.crossOrigin) {
        request = new XDomainRequest(); options.headers = {};
    }

    if (_.isPlainObject(options.xhr)) {
        _.extend(request, options.xhr);
    }

    if (_.isFunction(options.beforeSend)) {
        options.beforeSend.call(this, request, options);
    }

    promise = new Promise(function (resolve, reject) {

        request.open(options.method, _.url(options), true);

        _.each(options.headers, function (value, header) {
            request.setRequestHeader(header, value);
        });

        var handler = function (event) {

            request.ok = event.type === 'load';

            if (request.ok && request.status) {
                request.ok = request.status >= 200 && request.status < 300;
            }

            (request.ok ? resolve : reject)(request);
        };

        request.onload = handler;
        request.onabort = handler;
        request.onerror = handler;

        request.send(options.data);
    });

    return promise;
};

},{"./promise":4}],7:[function(require,module,exports){
/**
 * Service for interacting with RESTful services.
 */

module.exports = function (_) {

    function Resource(url, params, actions) {

        var self = this, resource = {};

        actions = _.extend({},
            Resource.actions,
            actions
        );

        _.each(actions, function (action, name) {

            action = _.extend(true, {url: url, params: params || {}}, action);

            resource[name] = function () {
                return (self.$http || _.http)(opts(action, arguments));
            };
        });

        return resource;
    }

    function opts(action, args) {

        var options = _.extend({}, action), params = {}, data, success, error;

        switch (args.length) {

            case 4:

                error = args[3];
                success = args[2];

            case 3:
            case 2:

                if (_.isFunction(args[1])) {

                    if (_.isFunction(args[0])) {

                        success = args[0];
                        error = args[1];

                        break;
                    }

                    success = args[1];
                    error = args[2];

                } else {

                    params = args[0];
                    data = args[1];
                    success = args[2];

                    break;
                }

            case 1:

                if (_.isFunction(args[0])) {
                    success = args[0];
                } else if (/^(POST|PUT|PATCH)$/i.test(options.method)) {
                    data = args[0];
                } else {
                    params = args[0];
                }

                break;

            case 0:

                break;

            default:

                throw 'Expected up to 4 arguments [params, data, success, error], got ' + args.length + ' arguments';
        }

        options.data = data;
        options.params = _.extend({}, options.params, params);

        if (success) {
            options.success = success;
        }

        if (error) {
            options.error = error;
        }

        return options;
    }

    Resource.actions = {

        get: {method: 'GET'},
        save: {method: 'POST'},
        query: {method: 'GET'},
        update: {method: 'PUT'},
        remove: {method: 'DELETE'},
        delete: {method: 'DELETE'}

    };

    return _.resource = Resource;
};

},{}],8:[function(require,module,exports){
/**
 * Service for URL templating.
 */

var ie = document.documentMode;
var el = document.createElement('a');

module.exports = function (_) {

    function Url(url, params) {

        var urlParams = {}, queryParams = {}, options = url, query;

        if (!_.isPlainObject(options)) {
            options = {url: url, params: params};
        }

        options = _.extend(true, {},
            Url.options, this.options, options
        );

        url = options.url.replace(/(\/?):([a-z]\w*)/gi, function (match, slash, name) {

            if (options.params[name]) {
                urlParams[name] = true;
                return slash + encodeUriSegment(options.params[name]);
            }

            return '';
        });

        if (_.isString(options.root) && !url.match(/^(https?:)?\//)) {
            url = options.root + '/' + url;
        }

        _.each(options.params, function (value, key) {
            if (!urlParams[key]) {
                queryParams[key] = value;
            }
        });

        query = Url.params(queryParams);

        if (query) {
            url += (url.indexOf('?') == -1 ? '?' : '&') + query;
        }

        return url;
    }

    /**
     * Url options.
     */

    Url.options = {
        url: '',
        root: null,
        params: {}
    };

    /**
     * Encodes a Url parameter string.
     *
     * @param {Object} obj
     */

    Url.params = function (obj) {

        var params = [];

        params.add = function (key, value) {

            if (_.isFunction (value)) {
                value = value();
            }

            if (value === null) {
                value = '';
            }

            this.push(encodeUriSegment(key) + '=' + encodeUriSegment(value));
        };

        serialize(params, obj);

        return params.join('&');
    };

    /**
     * Parse a URL and return its components.
     *
     * @param {String} url
     */

    Url.parse = function (url) {

        if (ie) {
            el.href = url;
            url = el.href;
        }

        el.href = url;

        return {
            href: el.href,
            protocol: el.protocol ? el.protocol.replace(/:$/, '') : '',
            port: el.port,
            host: el.host,
            hostname: el.hostname,
            pathname: el.pathname.charAt(0) === '/' ? el.pathname : '/' + el.pathname,
            search: el.search ? el.search.replace(/^\?/, '') : '',
            hash: el.hash ? el.hash.replace(/^#/, '') : ''
        };
    };

    function serialize(params, obj, scope) {

        var array = _.isArray(obj), plain = _.isPlainObject(obj), hash;

        _.each(obj, function (value, key) {

            hash = _.isObject(value) || _.isArray(value);

            if (scope) {
                key = scope + '[' + (plain || hash ? key : '') + ']';
            }

            if (!scope && array) {
                params.add(value.name, value.value);
            } else if (hash) {
                serialize(params, value, key);
            } else {
                params.add(key, value);
            }
        });
    }

    function encodeUriSegment(value) {

        return encodeUriQuery(value, true).
            replace(/%26/gi, '&').
            replace(/%3D/gi, '=').
            replace(/%2B/gi, '+');
    }

    function encodeUriQuery(value, spaces) {

        return encodeURIComponent(value).
            replace(/%40/gi, '@').
            replace(/%3A/gi, ':').
            replace(/%24/g, '$').
            replace(/%2C/gi, ',').
            replace(/%20/g, (spaces ? '%20' : '+'));
    }

    return _.url = Url;
};

},{}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('../util');

var regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;

// install v-link, which provides navigation support for
// HTML5 history mode

exports['default'] = function (Vue) {

  var _ = Vue.util;

  Vue.directive('link', {

    bind: function bind() {
      var _this = this;

      var vm = this.vm;
      /* istanbul ignore if */
      if (!vm.$route) {
        (0, _util.warn)('v-link can only be used inside a ' + 'router-enabled app.');
        return;
      }
      var router = vm.$route.router;
      this.handler = function (e) {
        // don't redirect with control keys
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        // don't redirect when preventDefault called
        if (e.defaultPrevented) return;
        // don't redirect on right click
        if (e.button !== 0) return;

        if (_this.el.tagName === 'A') {
          // v-link on <a v-link="'path'">
          e.preventDefault();
          if (_this.destination != null) {
            router.go(_this.destination);
          }
        } else {
          // v-link delegate on <div v-link>
          var el = e.target;
          while (el && el.tagName !== 'A' && el !== _this.el) {
            el = el.parentNode;
          }
          if (!el || el.tagName !== 'A' || !el.href) return;
          if (sameOrigin(el)) {
            e.preventDefault();
            router.go(el.pathname);
          }
        }
      };
      this.el.addEventListener('click', this.handler);
      // manage active link class
      this.unwatch = vm.$watch('$route.path', _.bind(this.updateClasses, this));
    },

    update: function update(path) {
      var router = this.vm.$route.router;
      path = router._normalizePath(path);
      this.destination = path;
      this.activeRE = path ? new RegExp('^' + path.replace(regexEscapeRE, '\\$&') + '\\b') : null;
      this.updateClasses(this.vm.$route.path);
      var isAbsolute = path.charAt(0) === '/';
      // do not format non-hash relative paths
      var href = router.mode === 'hash' || isAbsolute ? router.history.formatPath(path) : path;
      if (this.el.tagName === 'A') {
        if (href) {
          this.el.href = href;
        } else {
          this.el.removeAttribute('href');
        }
      }
    },

    updateClasses: function updateClasses(path) {
      var el = this.el;
      var dest = this.destination;
      var router = this.vm.$route.router;
      var activeClass = router._linkActiveClass;
      var exactClass = activeClass + '-exact';
      if (this.activeRE && this.activeRE.test(path) && path !== '/') {
        _.addClass(el, activeClass);
      } else {
        _.removeClass(el, activeClass);
      }
      if (path === dest) {
        _.addClass(el, exactClass);
      } else {
        _.removeClass(el, exactClass);
      }
    },

    unbind: function unbind() {
      this.el.removeEventListener('click', this.handler);
      this.unwatch && this.unwatch();
    }
  });

  function sameOrigin(link) {
    return link.protocol === location.protocol && link.hostname === location.hostname && link.port === location.port;
  }
};

module.exports = exports['default'];
},{"../util":21}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('../util');

var _pipeline = require('../pipeline');

exports['default'] = function (Vue) {

  var _ = Vue.util;
  var componentDef =
  // 0.12
  Vue.directive('_component') ||
  // 1.0
  Vue.internalDirectives.component;
  // <router-view> extends the internal component directive
  var viewDef = _.extend({}, componentDef);

  // with some overrides
  _.extend(viewDef, {

    _isRouterView: true,

    bind: function bind() {
      var route = this.vm.$route;
      /* istanbul ignore if */
      if (!route) {
        (0, _util.warn)('<router-view> can only be used inside a ' + 'router-enabled app.');
        return;
      }
      // force dynamic directive so v-component doesn't
      // attempt to build right now
      this._isDynamicLiteral = true;
      // finally, init by delegating to v-component
      componentDef.bind.call(this);

      // does not support keep-alive.
      /* istanbul ignore if */
      if (this.keepAlive) {
        this.keepAlive = false;
        (0, _util.warn)('<router-view> does not support keep-alive.');
      }
      /* istanbul ignore if */
      if (this.waitForEvent) {
        this.waitForEvent = null;
        (0, _util.warn)('<router-view> does not support wait-for. Use ' + 'the acitvate route hook instead.');
      }

      // all we need to do here is registering this view
      // in the router. actual component switching will be
      // managed by the pipeline.
      var router = this.router = route.router;
      router._views.unshift(this);

      // note the views are in reverse order.
      var parentView = router._views[1];
      if (parentView) {
        // register self as a child of the parent view,
        // instead of activating now. This is so that the
        // child's activate hook is called after the
        // parent's has resolved.
        parentView.childView = this;
      }

      // handle late-rendered view
      // two possibilities:
      // 1. root view rendered after transition has been
      //    validated;
      // 2. child view rendered after parent view has been
      //    activated.
      var transition = route.router._currentTransition;
      if (!parentView && transition.done || parentView && parentView.activated) {
        var depth = parentView ? parentView.depth + 1 : 0;
        (0, _pipeline.activate)(this, transition, depth);
      }
    },

    unbind: function unbind() {
      this.router._views.$remove(this);
      componentDef.unbind.call(this);
    }
  });

  Vue.elementDirective('router-view', viewDef);
};

module.exports = exports['default'];
},{"../pipeline":16,"../util":21}],11:[function(require,module,exports){
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('../util');

var AbstractHistory = (function () {
  function AbstractHistory(_ref) {
    var onChange = _ref.onChange;

    _classCallCheck(this, AbstractHistory);

    this.onChange = onChange;
    this.currentPath = '/';
  }

  _createClass(AbstractHistory, [{
    key: 'start',
    value: function start() {
      this.onChange('/');
    }
  }, {
    key: 'stop',
    value: function stop() {
      // noop
    }
  }, {
    key: 'go',
    value: function go(path) {
      path = this.currentPath = this.formatPath(path);
      this.onChange(path);
    }
  }, {
    key: 'formatPath',
    value: function formatPath(path) {
      return path.charAt(0) === '/' ? path : (0, _util.resolvePath)(this.currentPath, path);
    }
  }]);

  return AbstractHistory;
})();

exports['default'] = AbstractHistory;
module.exports = exports['default'];
},{"../util":21,"babel-runtime/helpers/class-call-check":24,"babel-runtime/helpers/create-class":25}],12:[function(require,module,exports){
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('../util');

var HashHistory = (function () {
  function HashHistory(_ref) {
    var hashbang = _ref.hashbang;
    var onChange = _ref.onChange;

    _classCallCheck(this, HashHistory);

    this.hashbang = hashbang;
    this.onChange = onChange;
  }

  _createClass(HashHistory, [{
    key: 'start',
    value: function start() {
      var self = this;
      this.listener = function () {
        var path = location.hash;
        var formattedPath = self.formatPath(path, true);
        if (formattedPath !== path) {
          location.replace(formattedPath);
          return;
        }
        var pathToMatch = decodeURI(path.replace(/^#!?/, '') + location.search);
        self.onChange(pathToMatch);
      };
      window.addEventListener('hashchange', this.listener);
      this.listener();
    }
  }, {
    key: 'stop',
    value: function stop() {
      window.removeEventListener('hashchange', this.listener);
    }
  }, {
    key: 'go',
    value: function go(path, replace) {
      path = this.formatPath(path);
      if (replace) {
        location.replace(path);
      } else {
        location.hash = path;
      }
    }
  }, {
    key: 'formatPath',
    value: function formatPath(path, expectAbsolute) {
      path = path.replace(/^#!?/, '');
      var isAbsoloute = path.charAt(0) === '/';
      if (expectAbsolute && !isAbsoloute) {
        path = '/' + path;
      }
      var prefix = '#' + (this.hashbang ? '!' : '');
      return isAbsoloute || expectAbsolute ? prefix + path : prefix + (0, _util.resolvePath)(location.hash.replace(/^#!?/, ''), path);
    }
  }]);

  return HashHistory;
})();

exports['default'] = HashHistory;
module.exports = exports['default'];
},{"../util":21,"babel-runtime/helpers/class-call-check":24,"babel-runtime/helpers/create-class":25}],13:[function(require,module,exports){
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('../util');

var hashRE = /#.*$/;

var HTML5History = (function () {
  function HTML5History(_ref) {
    var root = _ref.root;
    var onChange = _ref.onChange;

    _classCallCheck(this, HTML5History);

    if (root) {
      // make sure there's the starting slash
      if (root.charAt(0) !== '/') {
        root = '/' + root;
      }
      // remove trailing slash
      this.root = root.replace(/\/$/, '');
      this.rootRE = new RegExp('^\\' + this.root);
    } else {
      this.root = null;
    }
    this.onChange = onChange;
    // check base tag
    var baseEl = document.querySelector('base');
    this.base = baseEl && baseEl.getAttribute('href');
  }

  _createClass(HTML5History, [{
    key: 'start',
    value: function start() {
      var _this = this;

      this.listener = function (e) {
        var url = decodeURI(location.pathname + location.search);
        if (_this.root) {
          url = url.replace(_this.rootRE, '');
        }
        _this.onChange(url, e && e.state, location.hash);
      };
      window.addEventListener('popstate', this.listener);
      this.listener();
    }
  }, {
    key: 'stop',
    value: function stop() {
      window.removeEventListener('popstate', this.listener);
    }
  }, {
    key: 'go',
    value: function go(path, replace) {
      var root = this.root;
      var url = this.formatPath(path, root);
      if (replace) {
        history.replaceState({}, '', url);
      } else {
        // record scroll position by replacing current state
        history.replaceState({
          pos: {
            x: window.pageXOffset,
            y: window.pageYOffset
          }
        }, '');
        // then push new state
        history.pushState({}, '', url);
      }
      var hashMatch = path.match(hashRE);
      var hash = hashMatch && hashMatch[0];
      path = url
      // strip hash so it doesn't mess up params
      .replace(hashRE, '')
      // remove root before matching
      .replace(this.rootRE, '');
      this.onChange(path, null, hash);
    }
  }, {
    key: 'formatPath',
    value: function formatPath(path) {
      return path.charAt(0) === '/'
      // absolute path
      ? this.root ? this.root + '/' + path.replace(/^\//, '') : path : (0, _util.resolvePath)(this.base || location.pathname, path);
    }
  }]);

  return HTML5History;
})();

exports['default'] = HTML5History;
module.exports = exports['default'];
},{"../util":21,"babel-runtime/helpers/class-call-check":24,"babel-runtime/helpers/create-class":25}],14:[function(require,module,exports){
'use strict';

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('./util');

var _util2 = _interopRequireDefault(_util);

var _routeRecognizer = require('route-recognizer');

var _routeRecognizer2 = _interopRequireDefault(_routeRecognizer);

var _routerApi = require('./router/api');

var _routerApi2 = _interopRequireDefault(_routerApi);

var _routerInternal = require('./router/internal');

var _routerInternal2 = _interopRequireDefault(_routerInternal);

var _directivesView = require('./directives/view');

var _directivesView2 = _interopRequireDefault(_directivesView);

var _directivesLink = require('./directives/link');

var _directivesLink2 = _interopRequireDefault(_directivesLink);

var _override = require('./override');

var _override2 = _interopRequireDefault(_override);

var _historyAbstract = require('./history/abstract');

var _historyAbstract2 = _interopRequireDefault(_historyAbstract);

var _historyHash = require('./history/hash');

var _historyHash2 = _interopRequireDefault(_historyHash);

var _historyHtml5 = require('./history/html5');

var _historyHtml52 = _interopRequireDefault(_historyHtml5);

var historyBackends = {
  abstract: _historyAbstract2['default'],
  hash: _historyHash2['default'],
  html5: _historyHtml52['default']
};

/**
 * Router constructor
 *
 * @param {Object} [options]
 */

var Router = function Router() {
  var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var _ref$hashbang = _ref.hashbang;
  var hashbang = _ref$hashbang === undefined ? true : _ref$hashbang;
  var _ref$abstract = _ref.abstract;
  var abstract = _ref$abstract === undefined ? false : _ref$abstract;
  var _ref$history = _ref.history;
  var history = _ref$history === undefined ? false : _ref$history;
  var _ref$saveScrollPosition = _ref.saveScrollPosition;
  var saveScrollPosition = _ref$saveScrollPosition === undefined ? false : _ref$saveScrollPosition;
  var _ref$transitionOnLoad = _ref.transitionOnLoad;
  var transitionOnLoad = _ref$transitionOnLoad === undefined ? false : _ref$transitionOnLoad;
  var _ref$suppressTransitionError = _ref.suppressTransitionError;
  var suppressTransitionError = _ref$suppressTransitionError === undefined ? false : _ref$suppressTransitionError;
  var _ref$root = _ref.root;
  var root = _ref$root === undefined ? null : _ref$root;
  var _ref$linkActiveClass = _ref.linkActiveClass;
  var linkActiveClass = _ref$linkActiveClass === undefined ? 'v-link-active' : _ref$linkActiveClass;

  _classCallCheck(this, Router);

  /* istanbul ignore if */
  if (!Router.installed) {
    throw new Error('Please install the Router with Vue.use() before ' + 'creating an instance.');
  }

  // Vue instances
  this.app = null;
  this._views = [];
  this._children = [];

  // route recognizer
  this._recognizer = new _routeRecognizer2['default']();
  this._guardRecognizer = new _routeRecognizer2['default']();

  // state
  this._started = false;
  this._currentRoute = {};
  this._currentTransition = null;
  this._previousTransition = null;
  this._notFoundHandler = null;
  this._beforeEachHooks = [];
  this._afterEachHooks = [];

  // feature detection
  this._hasPushState = typeof window !== 'undefined' && window.history && window.history.pushState;

  // trigger transition on initial render?
  this._rendered = false;
  this._transitionOnLoad = transitionOnLoad;

  // history mode
  this._abstract = abstract;
  this._hashbang = hashbang;
  this._history = this._hasPushState && history;

  // other options
  this._saveScrollPosition = saveScrollPosition;
  this._linkActiveClass = linkActiveClass;
  this._suppress = suppressTransitionError;

  // create history object
  var inBrowser = _util2['default'].Vue.util.inBrowser;
  this.mode = !inBrowser || this._abstract ? 'abstract' : this._history ? 'html5' : 'hash';

  var History = historyBackends[this.mode];
  var self = this;
  this.history = new History({
    root: root,
    hashbang: this._hashbang,
    onChange: function onChange(path, state, anchor) {
      self._match(path, state, anchor);
    }
  });
};

exports['default'] = Router;

Router.installed = false;

/**
 * Installation interface.
 * Install the necessary directives.
 */

Router.install = function (Vue) {
  /* istanbul ignore if */
  if (Router.installed) {
    (0, _util.warn)('already installed.');
    return;
  }
  (0, _routerApi2['default'])(Vue, Router);
  (0, _routerInternal2['default'])(Vue, Router);
  (0, _directivesView2['default'])(Vue);
  (0, _directivesLink2['default'])(Vue);
  (0, _override2['default'])(Vue);
  _util2['default'].Vue = Vue;
  // 1.0 only: enable route mixins
  var strats = Vue.config.optionMergeStrategies;
  if (strats) {
    // use the same merge strategy as methods (object hash)
    strats.route = strats.methods;
  }
  Router.installed = true;
};

// auto install
/* istanbul ignore if */
if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(Router);
}
module.exports = exports['default'];
},{"./directives/link":9,"./directives/view":10,"./history/abstract":11,"./history/hash":12,"./history/html5":13,"./override":15,"./router/api":18,"./router/internal":19,"./util":21,"babel-runtime/helpers/class-call-check":24,"babel-runtime/helpers/interop-require-default":26,"route-recognizer":38}],15:[function(require,module,exports){
// overriding Vue's $addChild method, so that every child
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

exports['default'] = function (Vue) {

  var addChild = Vue.prototype.$addChild;

  Vue.prototype.$addChild = function (opts, Ctor) {

    var route = this.$route;
    var router = route && route.router;

    // inject meta
    if (router) {
      opts = opts || {};
      var meta = opts._meta = opts._meta || {};
      meta.$route = route;
      if (opts._isRouterView) {
        meta.$loadingRouteData = meta.$loadingRouteData || false;
      }
    }

    var child = addChild.call(this, opts, Ctor);

    if (router) {
      // keep track of all children created so we can
      // update the routes
      router._children.push(child);
      child.$on('hook:beforeDestroy', function () {
        router._children.$remove(child);
      });
    }

    return child;
  };
};

module.exports = exports['default'];
// instance inherits the route data
},{}],16:[function(require,module,exports){
'use strict';

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.canReuse = canReuse;
exports.canDeactivate = canDeactivate;
exports.canActivate = canActivate;
exports.deactivate = deactivate;
exports.activate = activate;
exports.reuse = reuse;

var _util = require('./util');

/**
 * Determine the reusability of an existing router view.
 *
 * @param {Directive} view
 * @param {Object} handler
 * @param {Transition} transition
 */

function canReuse(view, handler, transition) {
  var component = view.childVM;
  if (!component || !handler) {
    return false;
  }
  // important: check view.Component here because it may
  // have been changed in activate hook
  if (view.Component !== handler.component) {
    return false;
  }
  var canReuseFn = (0, _util.getRouteConfig)(component, 'canReuse');
  return typeof canReuseFn === 'boolean' ? canReuseFn : canReuseFn ? canReuseFn.call(component, {
    to: transition.to,
    from: transition.from
  }) : true; // defaults to true
}

/**
 * Check if a component can deactivate.
 *
 * @param {Directive} view
 * @param {Transition} transition
 * @param {Function} next
 */

function canDeactivate(view, transition, next) {
  var fromComponent = view.childVM;
  var hook = (0, _util.getRouteConfig)(fromComponent, 'canDeactivate');
  if (!hook) {
    next();
  } else {
    transition.callHook(hook, fromComponent, next, {
      expectBoolean: true
    });
  }
}

/**
 * Check if a component can activate.
 *
 * @param {Object} handler
 * @param {Transition} transition
 * @param {Function} next
 */

function canActivate(handler, transition, next) {
  (0, _util.resolveAsyncComponent)(handler, function (Component) {
    // have to check due to async-ness
    if (transition.aborted) {
      return;
    }
    // determine if this component can be activated
    var hook = (0, _util.getRouteConfig)(Component, 'canActivate');
    if (!hook) {
      next();
    } else {
      transition.callHook(hook, null, next, {
        expectBoolean: true
      });
    }
  });
}

/**
 * Call deactivate hooks for existing router-views.
 *
 * @param {Directive} view
 * @param {Transition} transition
 * @param {Function} next
 */

function deactivate(view, transition, next) {
  var component = view.childVM;
  var hook = (0, _util.getRouteConfig)(component, 'deactivate');
  if (!hook) {
    next();
  } else {
    transition.callHook(hook, component, next);
  }
}

/**
 * Activate / switch component for a router-view.
 *
 * @param {Directive} view
 * @param {Transition} transition
 * @param {Number} depth
 * @param {Function} [cb]
 */

function activate(view, transition, depth, cb) {
  var handler = transition.activateQueue[depth];
  if (!handler) {
    // fix 1.0.0-alpha.3 compat
    if (view._bound) {
      view.setComponent(null);
    }
    cb && cb();
    return;
  }

  var Component = view.Component = handler.component;
  var activateHook = (0, _util.getRouteConfig)(Component, 'activate');
  var dataHook = (0, _util.getRouteConfig)(Component, 'data');
  var waitForData = (0, _util.getRouteConfig)(Component, 'waitForData');

  view.depth = depth;
  view.activated = false;

  // unbuild current component. this step also destroys
  // and removes all nested child views.
  view.unbuild(true);
  // build the new component. this will also create the
  // direct child view of the current one. it will register
  // itself as view.childView.
  var component = view.build({
    _meta: {
      $loadingRouteData: !!(dataHook && !waitForData)
    }
  });

  // cleanup the component in case the transition is aborted
  // before the component is ever inserted.
  var cleanup = function cleanup() {
    component.$destroy();
  };

  // actually insert the component and trigger transition
  var insert = function insert() {
    var router = transition.router;
    if (router._rendered || router._transitionOnLoad) {
      view.transition(component);
    } else {
      // no transition on first render, manual transition
      if (view.setCurrent) {
        // 0.12 compat
        view.setCurrent(component);
      } else {
        // 1.0
        view.childVM = component;
      }
      component.$before(view.anchor, null, false);
    }
    cb && cb();
  };

  // called after activation hook is resolved
  var afterActivate = function afterActivate() {
    view.activated = true;
    // activate the child view
    if (view.childView) {
      exports.activate(view.childView, transition, depth + 1);
    }
    if (dataHook && waitForData) {
      // wait until data loaded to insert
      loadData(component, transition, dataHook, insert, cleanup);
    } else {
      // load data and insert at the same time
      if (dataHook) {
        loadData(component, transition, dataHook);
      }
      insert();
    }
  };

  if (activateHook) {
    transition.callHook(activateHook, component, afterActivate, {
      cleanup: cleanup
    });
  } else {
    afterActivate();
  }
}

/**
 * Reuse a view, just reload data if necessary.
 *
 * @param {Directive} view
 * @param {Transition} transition
 */

function reuse(view, transition) {
  var component = view.childVM;
  var dataHook = (0, _util.getRouteConfig)(component, 'data');
  if (dataHook) {
    loadData(component, transition, dataHook);
  }
}

/**
 * Asynchronously load and apply data to component.
 *
 * @param {Vue} component
 * @param {Transition} transition
 * @param {Function} hook
 * @param {Function} cb
 * @param {Function} cleanup
 */

function loadData(component, transition, hook, cb, cleanup) {
  component.$loadingRouteData = true;
  transition.callHook(hook, component, function (data, onError) {
    var promises = [];
    _Object$keys(data).forEach(function (key) {
      var val = data[key];
      if ((0, _util.isPromise)(val)) {
        promises.push(val.then(function (resolvedVal) {
          component.$set(key, resolvedVal);
        }));
      } else {
        component.$set(key, val);
      }
    });
    if (!promises.length) {
      component.$loadingRouteData = false;
    } else {
      promises[0].constructor.all(promises).then(function (_) {
        component.$loadingRouteData = false;
      }, onError);
    }
    cb && cb(data);
  }, {
    cleanup: cleanup,
    expectData: true
  });
}
},{"./util":21,"babel-runtime/core-js/object/keys":23}],17:[function(require,module,exports){
"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check")["default"];

Object.defineProperty(exports, "__esModule", {
  value: true
});
var internalKeysRE = /^(component|subRoutes|name)$/;

/**
 * Route Context Object
 *
 * @param {String} path
 * @param {Router} router
 */

var Route = function Route(path, router) {
  var _this = this;

  _classCallCheck(this, Route);

  var matched = router._recognizer.recognize(path);
  if (matched) {
    // copy all custom fields from route configs
    [].forEach.call(matched, function (match) {
      for (var key in match.handler) {
        if (!internalKeysRE.test(key)) {
          _this[key] = match.handler[key];
        }
      }
    });
    // set query and params
    this.query = matched.queryParams;
    this.params = [].reduce.call(matched, function (prev, cur) {
      if (cur.params) {
        for (var key in cur.params) {
          prev[key] = cur.params[key];
        }
      }
      return prev;
    }, {});
  }
  // expose path and router
  this.path = path;
  this.router = router;
  // for internal use
  this._matched = matched || router._notFoundHandler;
};

exports["default"] = Route;
module.exports = exports["default"];
},{"babel-runtime/helpers/class-call-check":24}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('../util');

exports['default'] = function (Vue, Router) {

  /**
   * Register a map of top-level paths.
   *
   * @param {Object} map
   */

  Router.prototype.map = function (map) {
    for (var route in map) {
      this.on(route, map[route]);
    }
  };

  /**
   * Register a single root-level path
   *
   * @param {String} rootPath
   * @param {Object} handler
   *                 - {String} component
   *                 - {Object} [subRoutes]
   *                 - {Boolean} [forceRefresh]
   *                 - {Function} [before]
   *                 - {Function} [after]
   */

  Router.prototype.on = function (rootPath, handler) {
    if (rootPath === '*') {
      this._notFound(handler);
    } else {
      this._addRoute(rootPath, handler, []);
    }
  };

  /**
   * Set redirects.
   *
   * @param {Object} map
   */

  Router.prototype.redirect = function (map) {
    for (var path in map) {
      this._addRedirect(path, map[path]);
    }
  };

  /**
   * Set aliases.
   *
   * @param {Object} map
   */

  Router.prototype.alias = function (map) {
    for (var path in map) {
      this._addAlias(path, map[path]);
    }
  };

  /**
   * Set global before hook.
   *
   * @param {Function} fn
   */

  Router.prototype.beforeEach = function (fn) {
    this._beforeEachHooks.push(fn);
  };

  /**
   * Set global after hook.
   *
   * @param {Function} fn
   */

  Router.prototype.afterEach = function (fn) {
    this._afterEachHooks.push(fn);
  };

  /**
   * Navigate to a given path.
   * The path can be an object describing a named path in
   * the format of { name: '...', params: {}, query: {}}
   * The path is assumed to be already decoded, and will
   * be resolved against root (if provided)
   *
   * @param {String|Object} path
   * @param {Boolean} [replace]
   */

  Router.prototype.go = function (path, replace) {
    path = this._normalizePath(path);
    this.history.go(path, replace);
  };

  /**
   * Short hand for replacing current path
   *
   * @param {String} path
   */

  Router.prototype.replace = function (path) {
    this.go(path, true);
  };

  /**
   * Start the router.
   *
   * @param {VueConstructor} App
   * @param {String|Element} container
   */

  Router.prototype.start = function (App, container) {
    /* istanbul ignore if */
    if (this._started) {
      (0, _util.warn)('already started.');
      return;
    }
    this._started = true;
    if (!this.app) {
      /* istanbul ignore if */
      if (!App || !container) {
        throw new Error('Must start vue-router with a component and a ' + 'root container.');
      }
      this._appContainer = container;
      this._appConstructor = typeof App === 'function' ? App : Vue.extend(App);
    }
    this.history.start();
  };

  /**
   * Stop listening to route changes.
   */

  Router.prototype.stop = function () {
    this.history.stop();
    this._started = false;
  };
};

module.exports = exports['default'];
},{"../util":21}],19:[function(require,module,exports){
'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('../util');

var _route = require('../route');

var _route2 = _interopRequireDefault(_route);

var _transition = require('../transition');

var _transition2 = _interopRequireDefault(_transition);

exports['default'] = function (Vue, Router) {

  var _ = Vue.util;

  /**
   * Add a route containing a list of segments to the internal
   * route recognizer. Will be called recursively to add all
   * possible sub-routes.
   *
   * @param {String} path
   * @param {Object} handler
   * @param {Array} segments
   */

  Router.prototype._addRoute = function (path, handler, segments) {
    guardComponent(handler);
    segments.push({
      path: path,
      handler: handler
    });
    this._recognizer.add(segments, {
      as: handler.name
    });
    // add sub routes
    if (handler.subRoutes) {
      for (var subPath in handler.subRoutes) {
        // recursively walk all sub routes
        this._addRoute(subPath, handler.subRoutes[subPath],
        // pass a copy in recursion to avoid mutating
        // across branches
        segments.slice());
      }
    }
  };

  /**
   * Set the notFound route handler.
   *
   * @param {Object} handler
   */

  Router.prototype._notFound = function (handler) {
    guardComponent(handler);
    this._notFoundHandler = [{ handler: handler }];
  };

  /**
   * Add a redirect record.
   *
   * @param {String} path
   * @param {String} redirectPath
   */

  Router.prototype._addRedirect = function (path, redirectPath) {
    this._addGuard(path, redirectPath, this.replace);
  };

  /**
   * Add an alias record.
   *
   * @param {String} path
   * @param {String} aliasPath
   */

  Router.prototype._addAlias = function (path, aliasPath) {
    this._addGuard(path, aliasPath, this._match);
  };

  /**
   * Add a path guard.
   *
   * @param {String} path
   * @param {String} mappedPath
   * @param {Function} handler
   */

  Router.prototype._addGuard = function (path, mappedPath, _handler) {
    var _this = this;

    this._guardRecognizer.add([{
      path: path,
      handler: function handler(match, query) {
        var realPath = (0, _util.mapParams)(mappedPath, match.params, query);
        _handler.call(_this, realPath);
      }
    }]);
  };

  /**
   * Check if a path matches any redirect records.
   *
   * @param {String} path
   * @return {Boolean} - if true, will skip normal match.
   */

  Router.prototype._checkGuard = function (path) {
    var matched = this._guardRecognizer.recognize(path);
    if (matched) {
      matched[0].handler(matched[0], matched.queryParams);
      return true;
    }
  };

  /**
   * Match a URL path and set the route context on vm,
   * triggering view updates.
   *
   * @param {String} path
   * @param {Object} [state]
   * @param {String} [anchor]
   */

  Router.prototype._match = function (path, state, anchor) {
    var _this2 = this;

    if (this._checkGuard(path)) {
      return;
    }

    var prevRoute = this._currentRoute;
    var prevTransition = this._currentTransition;

    // do nothing if going to the same route.
    // the route only changes when a transition successfully
    // reaches activation; we don't need to do anything
    // if an ongoing transition is aborted during validation
    // phase.
    if (prevTransition && path === prevRoute.path) {
      return;
    }

    // construct new route and transition context
    var route = new _route2['default'](path, this);
    var transition = new _transition2['default'](this, route, prevRoute);
    this._prevTransition = prevTransition;
    this._currentTransition = transition;

    if (!this.app) {
      // initial render
      this.app = new this._appConstructor({
        el: this._appContainer,
        _meta: {
          $route: route
        }
      });
    }

    // check global before hook
    var beforeHooks = this._beforeEachHooks;
    var startTransition = function startTransition() {
      transition.start(function () {
        _this2._postTransition(route, state, anchor);
      });
    };

    if (beforeHooks.length) {
      transition.runQueue(beforeHooks, function (hook, _, next) {
        if (transition === _this2._currentTransition) {
          transition.callHook(hook, null, next, true);
        }
      }, startTransition);
    } else {
      startTransition();
    }

    // HACK:
    // set rendered to true after the transition start, so
    // that components that are acitvated synchronously know
    // whether it is the initial render.
    this._rendered = true;
  };

  /**
   * Set current to the new transition.
   * This is called by the transition object when the
   * validation of a route has succeeded.
   *
   * @param {RouteTransition} transition
   */

  Router.prototype._onTransitionValidated = function (transition) {
    // now that this one is validated, we can abort
    // the previous transition.
    var prevTransition = this._prevTransition;
    if (prevTransition) {
      prevTransition.aborted = true;
    }
    // set current route
    var route = this._currentRoute = transition.to;
    // update route context for all children
    if (this.app.$route !== route) {
      this.app.$route = route;
      this._children.forEach(function (child) {
        child.$route = route;
      });
    }
    // call global after hook
    if (this._afterEachHooks.length) {
      this._afterEachHooks.forEach(function (hook) {
        return hook.call(null, {
          to: transition.to,
          from: transition.from
        });
      });
    }
    this._currentTransition.done = true;
  };

  /**
   * Handle stuff after the transition.
   *
   * @param {Route} route
   * @param {Object} [state]
   * @param {String} [anchor]
   */

  Router.prototype._postTransition = function (route, state, anchor) {
    // handle scroll positions
    // saved scroll positions take priority
    // then we check if the path has an anchor
    var pos = state && state.pos;
    if (pos && this._saveScrollPosition) {
      Vue.nextTick(function () {
        window.scrollTo(pos.x, pos.y);
      });
    } else if (anchor) {
      Vue.nextTick(function () {
        var el = document.getElementById(anchor.slice(1));
        if (el) {
          window.scrollTo(window.scrollX, el.offsetTop);
        }
      });
    }
  };

  /**
   * Normalize named route object / string paths into
   * a string.
   *
   * @param {Object|String|Number} path
   * @return {String}
   */

  Router.prototype._normalizePath = function (path) {
    if (typeof path === 'object') {
      if (path.name) {
        var params = path.params || {};
        if (path.query) {
          params.queryParams = path.query;
        }
        return this._recognizer.generate(path.name, params);
      } else if (path.path) {
        return path.path;
      } else {
        return '';
      }
    } else {
      return path + '';
    }
  };

  /**
   * Allow directly passing components to a route
   * definition.
   *
   * @param {Object} handler
   */

  function guardComponent(handler) {
    var comp = handler.component;
    if (_.isPlainObject(comp)) {
      comp = handler.component = Vue.extend(comp);
    }
    /* istanbul ignore if */
    if (typeof comp !== 'function') {
      handler.component = null;
      (0, _util.warn)('invalid component for route "' + handler.path + '"');
    }
  }
};

module.exports = exports['default'];
},{"../route":17,"../transition":20,"../util":21,"babel-runtime/helpers/interop-require-default":26}],20:[function(require,module,exports){
'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _util = require('./util');

var _pipeline = require('./pipeline');

/**
 * A RouteTransition object manages the pipeline of a
 * router-view switching process. This is also the object
 * passed into user route hooks.
 *
 * @param {Router} router
 * @param {Route} to
 * @param {Route} from
 */

var RouteTransition = (function () {
  function RouteTransition(router, to, from) {
    _classCallCheck(this, RouteTransition);

    this.router = router;
    this.to = to;
    this.from = from;
    this.next = null;
    this.aborted = false;
    this.done = false;

    // start by determine the queues

    // the deactivate queue is an array of router-view
    // directive instances that need to be deactivated,
    // deepest first.
    this.deactivateQueue = router._views;

    // check the default handler of the deepest match
    var matched = to._matched ? Array.prototype.slice.call(to._matched) : [];

    // the activate queue is an array of route handlers
    // that need to be activated
    this.activateQueue = matched.map(function (match) {
      return match.handler;
    });
  }

  /**
   * Abort current transition and return to previous location.
   */

  _createClass(RouteTransition, [{
    key: 'abort',
    value: function abort() {
      if (!this.aborted) {
        this.aborted = true;
        // if the root path throws an error during validation
        // on initial load, it gets caught in an infinite loop.
        var abortingOnLoad = !this.from.path && this.to.path === '/';
        if (!abortingOnLoad) {
          this.router.replace(this.from.path || '/');
        }
      }
    }

    /**
     * Abort current transition and redirect to a new location.
     *
     * @param {String} path
     */

  }, {
    key: 'redirect',
    value: function redirect(path) {
      if (!this.aborted) {
        this.aborted = true;
        if (typeof path === 'string') {
          path = (0, _util.mapParams)(path, this.to.params, this.to.query);
        } else {
          path.params = this.to.params;
          path.query = this.to.query;
        }
        this.router.replace(path);
      }
    }

    /**
     * A router view transition's pipeline can be described as
     * follows, assuming we are transitioning from an existing
     * <router-view> chain [Component A, Component B] to a new
     * chain [Component A, Component C]:
     *
     *  A    A
     *  | => |
     *  B    C
     *
     * 1. Reusablity phase:
     *   -> canReuse(A, A)
     *   -> canReuse(B, C)
     *   -> determine new queues:
     *      - deactivation: [B]
     *      - activation: [C]
     *
     * 2. Validation phase:
     *   -> canDeactivate(B)
     *   -> canActivate(C)
     *
     * 3. Activation phase:
     *   -> deactivate(B)
     *   -> activate(C)
     *
     * Each of these steps can be asynchronous, and any
     * step can potentially abort the transition.
     *
     * @param {Function} cb
     */

  }, {
    key: 'start',
    value: function start(cb) {
      var transition = this;
      var daq = this.deactivateQueue;
      var aq = this.activateQueue;
      var rdaq = daq.slice().reverse();
      var reuseQueue = undefined;

      // 1. Reusability phase
      var i = undefined;
      for (i = 0; i < rdaq.length; i++) {
        if (!(0, _pipeline.canReuse)(rdaq[i], aq[i], transition)) {
          break;
        }
      }
      if (i > 0) {
        reuseQueue = rdaq.slice(0, i);
        daq = rdaq.slice(i).reverse();
        aq = aq.slice(i);
      }

      // 2. Validation phase
      transition.runQueue(daq, _pipeline.canDeactivate, function () {
        transition.runQueue(aq, _pipeline.canActivate, function () {
          transition.runQueue(daq, _pipeline.deactivate, function () {
            // 3. Activation phase

            // Update router current route
            transition.router._onTransitionValidated(transition);

            // trigger reuse for all reused views
            reuseQueue && reuseQueue.forEach(function (view) {
              (0, _pipeline.reuse)(view, transition);
            });

            // the root of the chain that needs to be replaced
            // is the top-most non-reusable view.
            if (daq.length) {
              var view = daq[daq.length - 1];
              var depth = reuseQueue ? reuseQueue.length : 0;
              (0, _pipeline.activate)(view, transition, depth, cb);
            } else {
              cb();
            }
          });
        });
      });
    }

    /**
     * Asynchronously and sequentially apply a function to a
     * queue.
     *
     * @param {Array} queue
     * @param {Function} fn
     * @param {Function} cb
     */

  }, {
    key: 'runQueue',
    value: function runQueue(queue, fn, cb) {
      var transition = this;
      step(0);
      function step(index) {
        if (index >= queue.length) {
          cb();
        } else {
          fn(queue[index], transition, function () {
            step(index + 1);
          });
        }
      }
    }

    /**
     * Call a user provided route transition hook and handle
     * the response (e.g. if the user returns a promise).
     *
     * @param {Function} hook
     * @param {*} [context]
     * @param {Function} [cb]
     * @param {Object} [options]
     *                 - {Boolean} expectBoolean
     *                 - {Boolean} expectData
     *                 - {Function} cleanup
     */

  }, {
    key: 'callHook',
    value: function callHook(hook, context, cb) {
      var _ref = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

      var _ref$expectBoolean = _ref.expectBoolean;
      var expectBoolean = _ref$expectBoolean === undefined ? false : _ref$expectBoolean;
      var _ref$expectData = _ref.expectData;
      var expectData = _ref$expectData === undefined ? false : _ref$expectData;
      var cleanup = _ref.cleanup;

      var transition = this;
      var nextCalled = false;

      // abort the transition
      var abort = function abort(back) {
        cleanup && cleanup();
        transition.abort(back);
      };

      // handle errors
      var onError = function onError(err) {
        // cleanup indicates an after-activation hook,
        // so instead of aborting we just let the transition
        // finish.
        cleanup ? next() : abort();
        if (err && !transition.router._suppress) {
          (0, _util.warn)('Uncaught error during transition: ');
          throw err instanceof Error ? err : new Error(err);
        }
      };

      // advance the transition to the next step
      var next = function next(data) {
        if (nextCalled) {
          (0, _util.warn)('transition.next() should be called only once.');
          return;
        }
        nextCalled = true;
        if (!cb || transition.aborted) {
          return;
        }
        cb(data, onError);
      };

      // expose a clone of the transition object, so that each
      // hook gets a clean copy and prevent the user from
      // messing with the internals.
      var exposed = {
        to: transition.to,
        from: transition.from,
        abort: abort,
        next: next,
        redirect: function redirect() {
          transition.redirect.apply(transition, arguments);
        }
      };

      // actually call the hook
      var res = undefined;
      try {
        res = hook.call(context, exposed);
      } catch (err) {
        return onError(err);
      }

      // handle boolean/promise return values
      var resIsPromise = (0, _util.isPromise)(res);
      if (expectBoolean) {
        if (typeof res === 'boolean') {
          res ? next() : abort();
        } else if (resIsPromise) {
          res.then(function (ok) {
            ok ? next() : abort();
          }, onError);
        }
      } else if (resIsPromise) {
        res.then(next, onError);
      } else if (expectData && isPlainOjbect(res)) {
        next(res);
      }
    }
  }]);

  return RouteTransition;
})();

exports['default'] = RouteTransition;

function isPlainOjbect(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}
module.exports = exports['default'];
},{"./pipeline":16,"./util":21,"babel-runtime/helpers/class-call-check":24,"babel-runtime/helpers/create-class":25}],21:[function(require,module,exports){
'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.warn = warn;
exports.resolvePath = resolvePath;
exports.isPromise = isPromise;
exports.getRouteConfig = getRouteConfig;
exports.resolveAsyncComponent = resolveAsyncComponent;
exports.mapParams = mapParams;

var _routeRecognizer = require('route-recognizer');

var _routeRecognizer2 = _interopRequireDefault(_routeRecognizer);

var genQuery = _routeRecognizer2['default'].prototype.generateQueryString;

// export default for holding the Vue reference
var _exports = {};
exports['default'] = _exports;

/**
 * Warn stuff.
 *
 * @param {String} msg
 * @param {Error} [err]
 */

function warn(msg, err) {
  /* istanbul ignore next */
  if (window.console) {
    console.warn('[vue-router] ' + msg);
    if (err) {
      console.warn(err.stack);
    }
  }
}

/**
 * Resolve a relative path.
 *
 * @param {String} base
 * @param {String} relative
 * @return {String}
 */

function resolvePath(base, relative) {
  var query = base.match(/(\?.*)$/);
  if (query) {
    query = query[1];
    base = base.slice(0, -query.length);
  }
  // a query!
  if (relative.charAt(0) === '?') {
    return base + relative;
  }
  var stack = base.split('/');
  // remove trailing segment
  stack.pop();
  // resolve relative path
  var segments = relative.split('/');
  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    if (segment === '.') {
      continue;
    } else if (segment === '..') {
      stack.pop();
    } else {
      stack.push(segment);
    }
  }
  // ensure leading slash
  if (stack[0] !== '') {
    stack.unshift('');
  }
  return stack.join('/');
}

/**
 * Forgiving check for a promise
 *
 * @param {Object} p
 * @return {Boolean}
 */

function isPromise(p) {
  return p && typeof p.then === 'function';
}

/**
 * Retrive a route config field from a component instance
 * OR a component contructor.
 *
 * @param {Function|Vue} component
 * @param {String} name
 * @return {*}
 */

function getRouteConfig(component, name) {
  var options = component && (component.$options || component.options);
  return options && options.route && options.route[name];
}

/**
 * Resolve an async component factory. Have to do a dirty
 * mock here because of Vue core's internal API depends on
 * an ID check.
 *
 * @param {Object} handler
 * @param {Function} cb
 */

var resolver = undefined;

function resolveAsyncComponent(handler, cb) {
  if (!resolver) {
    resolver = {
      resolve: _exports.Vue.prototype._resolveComponent,
      $options: {
        components: {
          _: handler.component
        }
      }
    };
  } else {
    resolver.$options.components._ = handler.component;
  }
  resolver.resolve('_', function (Component) {
    handler.component = Component;
    cb(Component);
  });
}

/**
 * Map the dynamic segments in a path to params.
 *
 * @param {String} path
 * @param {Object} params
 * @param {Object} query
 */

function mapParams(path, params, query) {
  for (var key in params) {
    path = replaceParam(path, params, key);
  }
  if (query) {
    path += genQuery(query);
  }
  return path;
}

/**
 * Replace a param segment with real value in a matched
 * path.
 *
 * @param {String} path
 * @param {Object} params
 * @param {String} key
 * @return {String}
 */

function replaceParam(path, params, key) {
  var regex = new RegExp(':' + key + '(\\/|$)');
  var value = params[key];
  return path.replace(regex, function (m) {
    return m.charAt(m.length - 1) === '/' ? value + '/' : value;
  });
}
},{"babel-runtime/helpers/interop-require-default":26,"route-recognizer":38}],22:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/define-property"), __esModule: true };
},{"core-js/library/fn/object/define-property":27}],23:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/keys"), __esModule: true };
},{"core-js/library/fn/object/keys":28}],24:[function(require,module,exports){
"use strict";

exports["default"] = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

exports.__esModule = true;
},{}],25:[function(require,module,exports){
"use strict";

var _Object$defineProperty = require("babel-runtime/core-js/object/define-property")["default"];

exports["default"] = (function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;

      _Object$defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
})();

exports.__esModule = true;
},{"babel-runtime/core-js/object/define-property":22}],26:[function(require,module,exports){
"use strict";

exports["default"] = function (obj) {
  return obj && obj.__esModule ? obj : {
    "default": obj
  };
};

exports.__esModule = true;
},{}],27:[function(require,module,exports){
var $ = require('../../modules/$');
module.exports = function defineProperty(it, key, desc){
  return $.setDesc(it, key, desc);
};
},{"../../modules/$":34}],28:[function(require,module,exports){
require('../../modules/es6.object.keys');
module.exports = require('../../modules/$.core').Object.keys;
},{"../../modules/$.core":29,"../../modules/es6.object.keys":37}],29:[function(require,module,exports){
var core = module.exports = {version: '1.2.0'};
if(typeof __e == 'number')__e = core; // eslint-disable-line no-undef
},{}],30:[function(require,module,exports){
var global    = require('./$.global')
  , core      = require('./$.core')
  , PROTOTYPE = 'prototype';
var ctx = function(fn, that){
  return function(){
    return fn.apply(that, arguments);
  };
};
var $def = function(type, name, source){
  var key, own, out, exp
    , isGlobal = type & $def.G
    , isProto  = type & $def.P
    , target   = isGlobal ? global : type & $def.S
        ? global[name] : (global[name] || {})[PROTOTYPE]
    , exports  = isGlobal ? core : core[name] || (core[name] = {});
  if(isGlobal)source = name;
  for(key in source){
    // contains in native
    own = !(type & $def.F) && target && key in target;
    if(own && key in exports)continue;
    // export native or passed
    out = own ? target[key] : source[key];
    // prevent global pollution for namespaces
    if(isGlobal && typeof target[key] != 'function')exp = source[key];
    // bind timers to global for call from export context
    else if(type & $def.B && own)exp = ctx(out, global);
    // wrap global constructors for prevent change them in library
    else if(type & $def.W && target[key] == out)!function(C){
      exp = function(param){
        return this instanceof C ? new C(param) : C(param);
      };
      exp[PROTOTYPE] = C[PROTOTYPE];
    }(out);
    else exp = isProto && typeof out == 'function' ? ctx(Function.call, out) : out;
    // export
    exports[key] = exp;
    if(isProto)(exports[PROTOTYPE] || (exports[PROTOTYPE] = {}))[key] = out;
  }
};
// type bitmap
$def.F = 1;  // forced
$def.G = 2;  // global
$def.S = 4;  // static
$def.P = 8;  // proto
$def.B = 16; // bind
$def.W = 32; // wrap
module.exports = $def;
},{"./$.core":29,"./$.global":33}],31:[function(require,module,exports){
// 7.2.1 RequireObjectCoercible(argument)
module.exports = function(it){
  if(it == undefined)throw TypeError("Can't call method on  " + it);
  return it;
};
},{}],32:[function(require,module,exports){
module.exports = function(exec){
  try {
    return !!exec();
  } catch(e){
    return true;
  }
};
},{}],33:[function(require,module,exports){
// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var UNDEFINED = 'undefined';
var global = module.exports = typeof window != UNDEFINED && window.Math == Math
  ? window : typeof self != UNDEFINED && self.Math == Math ? self : Function('return this')();
if(typeof __g == 'number')__g = global; // eslint-disable-line no-undef
},{}],34:[function(require,module,exports){
var $Object = Object;
module.exports = {
  create:     $Object.create,
  getProto:   $Object.getPrototypeOf,
  isEnum:     {}.propertyIsEnumerable,
  getDesc:    $Object.getOwnPropertyDescriptor,
  setDesc:    $Object.defineProperty,
  setDescs:   $Object.defineProperties,
  getKeys:    $Object.keys,
  getNames:   $Object.getOwnPropertyNames,
  getSymbols: $Object.getOwnPropertySymbols,
  each:       [].forEach
};
},{}],35:[function(require,module,exports){
// most Object methods by ES6 should accept primitives
module.exports = function(KEY, exec){
  var $def = require('./$.def')
    , fn   = (require('./$.core').Object || {})[KEY] || Object[KEY]
    , exp  = {};
  exp[KEY] = exec(fn);
  $def($def.S + $def.F * require('./$.fails')(function(){ fn(1); }), 'Object', exp);
};
},{"./$.core":29,"./$.def":30,"./$.fails":32}],36:[function(require,module,exports){
// 7.1.13 ToObject(argument)
var defined = require('./$.defined');
module.exports = function(it){
  return Object(defined(it));
};
},{"./$.defined":31}],37:[function(require,module,exports){
// 19.1.2.14 Object.keys(O)
var toObject = require('./$.to-object');

require('./$.object-sap')('keys', function($keys){
  return function keys(it){
    return $keys(toObject(it));
  };
});
},{"./$.object-sap":35,"./$.to-object":36}],38:[function(require,module,exports){
(function() {
    "use strict";
    function $$route$recognizer$dsl$$Target(path, matcher, delegate) {
      this.path = path;
      this.matcher = matcher;
      this.delegate = delegate;
    }

    $$route$recognizer$dsl$$Target.prototype = {
      to: function(target, callback) {
        var delegate = this.delegate;

        if (delegate && delegate.willAddRoute) {
          target = delegate.willAddRoute(this.matcher.target, target);
        }

        this.matcher.add(this.path, target);

        if (callback) {
          if (callback.length === 0) { throw new Error("You must have an argument in the function passed to `to`"); }
          this.matcher.addChild(this.path, target, callback, this.delegate);
        }
        return this;
      }
    };

    function $$route$recognizer$dsl$$Matcher(target) {
      this.routes = {};
      this.children = {};
      this.target = target;
    }

    $$route$recognizer$dsl$$Matcher.prototype = {
      add: function(path, handler) {
        this.routes[path] = handler;
      },

      addChild: function(path, target, callback, delegate) {
        var matcher = new $$route$recognizer$dsl$$Matcher(target);
        this.children[path] = matcher;

        var match = $$route$recognizer$dsl$$generateMatch(path, matcher, delegate);

        if (delegate && delegate.contextEntered) {
          delegate.contextEntered(target, match);
        }

        callback(match);
      }
    };

    function $$route$recognizer$dsl$$generateMatch(startingPath, matcher, delegate) {
      return function(path, nestedCallback) {
        var fullPath = startingPath + path;

        if (nestedCallback) {
          nestedCallback($$route$recognizer$dsl$$generateMatch(fullPath, matcher, delegate));
        } else {
          return new $$route$recognizer$dsl$$Target(startingPath + path, matcher, delegate);
        }
      };
    }

    function $$route$recognizer$dsl$$addRoute(routeArray, path, handler) {
      var len = 0;
      for (var i=0, l=routeArray.length; i<l; i++) {
        len += routeArray[i].path.length;
      }

      path = path.substr(len);
      var route = { path: path, handler: handler };
      routeArray.push(route);
    }

    function $$route$recognizer$dsl$$eachRoute(baseRoute, matcher, callback, binding) {
      var routes = matcher.routes;

      for (var path in routes) {
        if (routes.hasOwnProperty(path)) {
          var routeArray = baseRoute.slice();
          $$route$recognizer$dsl$$addRoute(routeArray, path, routes[path]);

          if (matcher.children[path]) {
            $$route$recognizer$dsl$$eachRoute(routeArray, matcher.children[path], callback, binding);
          } else {
            callback.call(binding, routeArray);
          }
        }
      }
    }

    var $$route$recognizer$dsl$$default = function(callback, addRouteCallback) {
      var matcher = new $$route$recognizer$dsl$$Matcher();

      callback($$route$recognizer$dsl$$generateMatch("", matcher, this.delegate));

      $$route$recognizer$dsl$$eachRoute([], matcher, function(route) {
        if (addRouteCallback) { addRouteCallback(this, route); }
        else { this.add(route); }
      }, this);
    };

    var $$route$recognizer$$specials = [
      '/', '.', '*', '+', '?', '|',
      '(', ')', '[', ']', '{', '}', '\\'
    ];

    var $$route$recognizer$$escapeRegex = new RegExp('(\\' + $$route$recognizer$$specials.join('|\\') + ')', 'g');

    function $$route$recognizer$$isArray(test) {
      return Object.prototype.toString.call(test) === "[object Array]";
    }

    // A Segment represents a segment in the original route description.
    // Each Segment type provides an `eachChar` and `regex` method.
    //
    // The `eachChar` method invokes the callback with one or more character
    // specifications. A character specification consumes one or more input
    // characters.
    //
    // The `regex` method returns a regex fragment for the segment. If the
    // segment is a dynamic of star segment, the regex fragment also includes
    // a capture.
    //
    // A character specification contains:
    //
    // * `validChars`: a String with a list of all valid characters, or
    // * `invalidChars`: a String with a list of all invalid characters
    // * `repeat`: true if the character specification can repeat

    function $$route$recognizer$$StaticSegment(string) { this.string = string; }
    $$route$recognizer$$StaticSegment.prototype = {
      eachChar: function(callback) {
        var string = this.string, ch;

        for (var i=0, l=string.length; i<l; i++) {
          ch = string.charAt(i);
          callback({ validChars: ch });
        }
      },

      regex: function() {
        return this.string.replace($$route$recognizer$$escapeRegex, '\\$1');
      },

      generate: function() {
        return this.string;
      }
    };

    function $$route$recognizer$$DynamicSegment(name) { this.name = name; }
    $$route$recognizer$$DynamicSegment.prototype = {
      eachChar: function(callback) {
        callback({ invalidChars: "/", repeat: true });
      },

      regex: function() {
        return "([^/]+)";
      },

      generate: function(params) {
        return params[this.name];
      }
    };

    function $$route$recognizer$$StarSegment(name) { this.name = name; }
    $$route$recognizer$$StarSegment.prototype = {
      eachChar: function(callback) {
        callback({ invalidChars: "", repeat: true });
      },

      regex: function() {
        return "(.+)";
      },

      generate: function(params) {
        return params[this.name];
      }
    };

    function $$route$recognizer$$EpsilonSegment() {}
    $$route$recognizer$$EpsilonSegment.prototype = {
      eachChar: function() {},
      regex: function() { return ""; },
      generate: function() { return ""; }
    };

    function $$route$recognizer$$parse(route, names, specificity) {
      // normalize route as not starting with a "/". Recognition will
      // also normalize.
      if (route.charAt(0) === "/") { route = route.substr(1); }

      var segments = route.split("/"), results = [];

      // A routes has specificity determined by the order that its different segments
      // appear in. This system mirrors how the magnitude of numbers written as strings
      // works.
      // Consider a number written as: "abc". An example would be "200". Any other number written
      // "xyz" will be smaller than "abc" so long as `a > z`. For instance, "199" is smaller
      // then "200", even though "y" and "z" (which are both 9) are larger than "0" (the value
      // of (`b` and `c`). This is because the leading symbol, "2", is larger than the other
      // leading symbol, "1".
      // The rule is that symbols to the left carry more weight than symbols to the right
      // when a number is written out as a string. In the above strings, the leading digit
      // represents how many 100's are in the number, and it carries more weight than the middle
      // number which represents how many 10's are in the number.
      // This system of number magnitude works well for route specificity, too. A route written as
      // `a/b/c` will be more specific than `x/y/z` as long as `a` is more specific than
      // `x`, irrespective of the other parts.
      // Because of this similarity, we assign each type of segment a number value written as a
      // string. We can find the specificity of compound routes by concatenating these strings
      // together, from left to right. After we have looped through all of the segments,
      // we convert the string to a number.
      specificity.val = '';

      for (var i=0, l=segments.length; i<l; i++) {
        var segment = segments[i], match;

        if (match = segment.match(/^:([^\/]+)$/)) {
          results.push(new $$route$recognizer$$DynamicSegment(match[1]));
          names.push(match[1]);
          specificity.val += '3';
        } else if (match = segment.match(/^\*([^\/]+)$/)) {
          results.push(new $$route$recognizer$$StarSegment(match[1]));
          specificity.val += '2';
          names.push(match[1]);
        } else if(segment === "") {
          results.push(new $$route$recognizer$$EpsilonSegment());
          specificity.val += '1';
        } else {
          results.push(new $$route$recognizer$$StaticSegment(segment));
          specificity.val += '4';
        }
      }

      specificity.val = +specificity.val;

      return results;
    }

    // A State has a character specification and (`charSpec`) and a list of possible
    // subsequent states (`nextStates`).
    //
    // If a State is an accepting state, it will also have several additional
    // properties:
    //
    // * `regex`: A regular expression that is used to extract parameters from paths
    //   that reached this accepting state.
    // * `handlers`: Information on how to convert the list of captures into calls
    //   to registered handlers with the specified parameters
    // * `types`: How many static, dynamic or star segments in this route. Used to
    //   decide which route to use if multiple registered routes match a path.
    //
    // Currently, State is implemented naively by looping over `nextStates` and
    // comparing a character specification against a character. A more efficient
    // implementation would use a hash of keys pointing at one or more next states.

    function $$route$recognizer$$State(charSpec) {
      this.charSpec = charSpec;
      this.nextStates = [];
    }

    $$route$recognizer$$State.prototype = {
      get: function(charSpec) {
        var nextStates = this.nextStates;

        for (var i=0, l=nextStates.length; i<l; i++) {
          var child = nextStates[i];

          var isEqual = child.charSpec.validChars === charSpec.validChars;
          isEqual = isEqual && child.charSpec.invalidChars === charSpec.invalidChars;

          if (isEqual) { return child; }
        }
      },

      put: function(charSpec) {
        var state;

        // If the character specification already exists in a child of the current
        // state, just return that state.
        if (state = this.get(charSpec)) { return state; }

        // Make a new state for the character spec
        state = new $$route$recognizer$$State(charSpec);

        // Insert the new state as a child of the current state
        this.nextStates.push(state);

        // If this character specification repeats, insert the new state as a child
        // of itself. Note that this will not trigger an infinite loop because each
        // transition during recognition consumes a character.
        if (charSpec.repeat) {
          state.nextStates.push(state);
        }

        // Return the new state
        return state;
      },

      // Find a list of child states matching the next character
      match: function(ch) {
        // DEBUG "Processing `" + ch + "`:"
        var nextStates = this.nextStates,
            child, charSpec, chars;

        // DEBUG "  " + debugState(this)
        var returned = [];

        for (var i=0, l=nextStates.length; i<l; i++) {
          child = nextStates[i];

          charSpec = child.charSpec;

          if (typeof (chars = charSpec.validChars) !== 'undefined') {
            if (chars.indexOf(ch) !== -1) { returned.push(child); }
          } else if (typeof (chars = charSpec.invalidChars) !== 'undefined') {
            if (chars.indexOf(ch) === -1) { returned.push(child); }
          }
        }

        return returned;
      }

      /** IF DEBUG
      , debug: function() {
        var charSpec = this.charSpec,
            debug = "[",
            chars = charSpec.validChars || charSpec.invalidChars;

        if (charSpec.invalidChars) { debug += "^"; }
        debug += chars;
        debug += "]";

        if (charSpec.repeat) { debug += "+"; }

        return debug;
      }
      END IF **/
    };

    /** IF DEBUG
    function debug(log) {
      console.log(log);
    }

    function debugState(state) {
      return state.nextStates.map(function(n) {
        if (n.nextStates.length === 0) { return "( " + n.debug() + " [accepting] )"; }
        return "( " + n.debug() + " <then> " + n.nextStates.map(function(s) { return s.debug() }).join(" or ") + " )";
      }).join(", ")
    }
    END IF **/

    // Sort the routes by specificity
    function $$route$recognizer$$sortSolutions(states) {
      return states.sort(function(a, b) {
        return b.specificity.val - a.specificity.val;
      });
    }

    function $$route$recognizer$$recognizeChar(states, ch) {
      var nextStates = [];

      for (var i=0, l=states.length; i<l; i++) {
        var state = states[i];

        nextStates = nextStates.concat(state.match(ch));
      }

      return nextStates;
    }

    var $$route$recognizer$$oCreate = Object.create || function(proto) {
      function F() {}
      F.prototype = proto;
      return new F();
    };

    function $$route$recognizer$$RecognizeResults(queryParams) {
      this.queryParams = queryParams || {};
    }
    $$route$recognizer$$RecognizeResults.prototype = $$route$recognizer$$oCreate({
      splice: Array.prototype.splice,
      slice:  Array.prototype.slice,
      push:   Array.prototype.push,
      length: 0,
      queryParams: null
    });

    function $$route$recognizer$$findHandler(state, path, queryParams) {
      var handlers = state.handlers, regex = state.regex;
      var captures = path.match(regex), currentCapture = 1;
      var result = new $$route$recognizer$$RecognizeResults(queryParams);

      for (var i=0, l=handlers.length; i<l; i++) {
        var handler = handlers[i], names = handler.names, params = {};

        for (var j=0, m=names.length; j<m; j++) {
          params[names[j]] = captures[currentCapture++];
        }

        result.push({ handler: handler.handler, params: params, isDynamic: !!names.length });
      }

      return result;
    }

    function $$route$recognizer$$addSegment(currentState, segment) {
      segment.eachChar(function(ch) {
        var state;

        currentState = currentState.put(ch);
      });

      return currentState;
    }

    function $$route$recognizer$$decodeQueryParamPart(part) {
      // http://www.w3.org/TR/html401/interact/forms.html#h-17.13.4.1
      part = part.replace(/\+/gm, '%20');
      return decodeURIComponent(part);
    }

    // The main interface

    var $$route$recognizer$$RouteRecognizer = function() {
      this.rootState = new $$route$recognizer$$State();
      this.names = {};
    };


    $$route$recognizer$$RouteRecognizer.prototype = {
      add: function(routes, options) {
        var currentState = this.rootState, regex = "^",
            specificity = {},
            handlers = [], allSegments = [], name;

        var isEmpty = true;

        for (var i=0, l=routes.length; i<l; i++) {
          var route = routes[i], names = [];

          var segments = $$route$recognizer$$parse(route.path, names, specificity);

          allSegments = allSegments.concat(segments);

          for (var j=0, m=segments.length; j<m; j++) {
            var segment = segments[j];

            if (segment instanceof $$route$recognizer$$EpsilonSegment) { continue; }

            isEmpty = false;

            // Add a "/" for the new segment
            currentState = currentState.put({ validChars: "/" });
            regex += "/";

            // Add a representation of the segment to the NFA and regex
            currentState = $$route$recognizer$$addSegment(currentState, segment);
            regex += segment.regex();
          }

          var handler = { handler: route.handler, names: names };
          handlers.push(handler);
        }

        if (isEmpty) {
          currentState = currentState.put({ validChars: "/" });
          regex += "/";
        }

        currentState.handlers = handlers;
        currentState.regex = new RegExp(regex + "$");
        currentState.specificity = specificity;

        if (name = options && options.as) {
          this.names[name] = {
            segments: allSegments,
            handlers: handlers
          };
        }
      },

      handlersFor: function(name) {
        var route = this.names[name], result = [];
        if (!route) { throw new Error("There is no route named " + name); }

        for (var i=0, l=route.handlers.length; i<l; i++) {
          result.push(route.handlers[i]);
        }

        return result;
      },

      hasRoute: function(name) {
        return !!this.names[name];
      },

      generate: function(name, params) {
        var route = this.names[name], output = "";
        if (!route) { throw new Error("There is no route named " + name); }

        var segments = route.segments;

        for (var i=0, l=segments.length; i<l; i++) {
          var segment = segments[i];

          if (segment instanceof $$route$recognizer$$EpsilonSegment) { continue; }

          output += "/";
          output += segment.generate(params);
        }

        if (output.charAt(0) !== '/') { output = '/' + output; }

        if (params && params.queryParams) {
          output += this.generateQueryString(params.queryParams, route.handlers);
        }

        return output;
      },

      generateQueryString: function(params, handlers) {
        var pairs = [];
        var keys = [];
        for(var key in params) {
          if (params.hasOwnProperty(key)) {
            keys.push(key);
          }
        }
        keys.sort();
        for (var i = 0, len = keys.length; i < len; i++) {
          key = keys[i];
          var value = params[key];
          if (value == null) {
            continue;
          }
          var pair = encodeURIComponent(key);
          if ($$route$recognizer$$isArray(value)) {
            for (var j = 0, l = value.length; j < l; j++) {
              var arrayPair = key + '[]' + '=' + encodeURIComponent(value[j]);
              pairs.push(arrayPair);
            }
          } else {
            pair += "=" + encodeURIComponent(value);
            pairs.push(pair);
          }
        }

        if (pairs.length === 0) { return ''; }

        return "?" + pairs.join("&");
      },

      parseQueryString: function(queryString) {
        var pairs = queryString.split("&"), queryParams = {};
        for(var i=0; i < pairs.length; i++) {
          var pair      = pairs[i].split('='),
              key       = $$route$recognizer$$decodeQueryParamPart(pair[0]),
              keyLength = key.length,
              isArray = false,
              value;
          if (pair.length === 1) {
            value = 'true';
          } else {
            //Handle arrays
            if (keyLength > 2 && key.slice(keyLength -2) === '[]') {
              isArray = true;
              key = key.slice(0, keyLength - 2);
              if(!queryParams[key]) {
                queryParams[key] = [];
              }
            }
            value = pair[1] ? $$route$recognizer$$decodeQueryParamPart(pair[1]) : '';
          }
          if (isArray) {
            queryParams[key].push(value);
          } else {
            queryParams[key] = value;
          }
        }
        return queryParams;
      },

      recognize: function(path) {
        var states = [ this.rootState ],
            pathLen, i, l, queryStart, queryParams = {},
            isSlashDropped = false;

        queryStart = path.indexOf('?');
        if (queryStart !== -1) {
          var queryString = path.substr(queryStart + 1, path.length);
          path = path.substr(0, queryStart);
          queryParams = this.parseQueryString(queryString);
        }

        path = decodeURI(path);

        // DEBUG GROUP path

        if (path.charAt(0) !== "/") { path = "/" + path; }

        pathLen = path.length;
        if (pathLen > 1 && path.charAt(pathLen - 1) === "/") {
          path = path.substr(0, pathLen - 1);
          isSlashDropped = true;
        }

        for (i=0, l=path.length; i<l; i++) {
          states = $$route$recognizer$$recognizeChar(states, path.charAt(i));
          if (!states.length) { break; }
        }

        // END DEBUG GROUP

        var solutions = [];
        for (i=0, l=states.length; i<l; i++) {
          if (states[i].handlers) { solutions.push(states[i]); }
        }

        states = $$route$recognizer$$sortSolutions(solutions);

        var state = solutions[0];

        if (state && state.handlers) {
          // if a trailing slash was dropped and a star segment is the last segment
          // specified, put the trailing slash back
          if (isSlashDropped && state.regex.source.slice(-5) === "(.+)$") {
            path = path + "/";
          }
          return $$route$recognizer$$findHandler(state, path, queryParams);
        }
      }
    };

    $$route$recognizer$$RouteRecognizer.prototype.map = $$route$recognizer$dsl$$default;

    $$route$recognizer$$RouteRecognizer.VERSION = '0.1.9';

    var $$route$recognizer$$default = $$route$recognizer$$RouteRecognizer;

    /* global define:true module:true window: true */
    if (typeof define === 'function' && define['amd']) {
      define('route-recognizer', function() { return $$route$recognizer$$default; });
    } else if (typeof module !== 'undefined' && module['exports']) {
      module['exports'] = $$route$recognizer$$default;
    } else if (typeof this !== 'undefined') {
      this['RouteRecognizer'] = $$route$recognizer$$default;
    }
}).call(this);


},{}],39:[function(require,module,exports){
'use strict';

var VueRouter = require('vue-router');
var VueResource = require('vue-resource');

Vue.use(VueRouter);
Vue.use(VueResource);

// Initializing the router with options
var router = new VueRouter({
    history: false
});

// Redirect certain routes to other routes
router.redirect({
    '/': '/home'
});

// Define your routes here.
router.map(require('./routes'));

Vue.http.headers.common['X-CSRF-TOKEN'] = document.querySelector('#token').getAttribute('value');

// Declaring the app itself
var App = Vue.extend({
    http: {
        root: '/'
    }
});

// Vue.config.debug = true; // turn on debugging mode

// Initializing the whole thing together
router.start(App, '#app');

},{"./routes":40,"vue-resource":2,"vue-router":14}],40:[function(require,module,exports){
'use strict';

module.exports = {
    // Not found handler
    '*': {
        component: require('./views/404/404.js')
    },
    '/home': {
        component: require('./views/home/home.js')
    },
    '/about': {
        component: require('./views/about/about.js')
    },
    '/therapeutic-benefits': {
        component: require('./views/therapeutic-benefits/therapeutic-benefits.js')
    },
    '/contraindications': {
        component: require('./views/contraindications/contraindications.js')
    },
    '/modalities': {
        component: require('./views/modalities/modalities.js')
    },
    '/first-time-clients': {
        component: require('./views/first-time-clients/first-time-clients.js')
    },
    '/policies': {
        component: require('./views/policies/policies.js')
    },
    '/location': {
        component: require('./views/location/location.js')
    },
    '/links': {
        component: require('./views/links/links.js')
    },
    '/rates': {
        component: require('./views/rates/rates.js')
    },
    '/contact': {
        component: require('./views/contact/contact.js')
    },
    '/thank-you': {
        component: require('./views/thank-you/thank-you.js')
    }
};

},{"./views/404/404.js":41,"./views/about/about.js":43,"./views/contact/contact.js":45,"./views/contraindications/contraindications.js":47,"./views/first-time-clients/first-time-clients.js":49,"./views/home/home.js":51,"./views/links/links.js":53,"./views/location/location.js":55,"./views/modalities/modalities.js":57,"./views/policies/policies.js":59,"./views/rates/rates.js":61,"./views/thank-you/thank-you.js":63,"./views/therapeutic-benefits/therapeutic-benefits.js":65}],41:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./404.template.html')

};

},{"./404.template.html":42}],42:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/ore.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/ore.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>page not found</h1>\n\n        <p>we\'re sorry, but your page could not be found.  please try again later or use our <a href=\'/contact\'>contact form</a> to reach us.</p>\n\n    </div>\n</div>';
},{}],43:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./about.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/about', function (data, status, request) {

            // set data on vm
            this.$set('about', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'about': ''
        };
    }

};

},{"./about.template.html":44}],44:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button active" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/about.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/about.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ about.title }}</h1>\n\n        <span v-html="about.body"></span>\n\n    </div>\n</div>';
},{}],45:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./contact.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/contact', function (data, status, request) {

            // set data on vm
            this.$set('contact', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'contact': ''
        };
    },

    methods: {

        sendEmail: function sendEmail(e) {

            e.preventDefault();

            var name = $('#name').val();

            var phone = $('#phone').val();

            var email = $('#email').val();

            var message = $('#message').val();

            this.$http.post('/contact', {
                name: name,
                phone: phone,
                email: email,
                message: message
            }, function (data) {}).success(function (data) {
                window.location = '/#!/thank-you';
            }).error(function (data) {
                $(data).each(function (index, value) {
                    if (data.name.length > 0) {
                        $('#name-field').find('.error').html('<p class="alert alert-danger">' + data.name + '</p>');
                    }

                    if (data.email.length > 0) {
                        $('#email-field').find('.error').html('<p class="alert alert-danger">' + data.email + '</p>');
                    }

                    if (data.message.length > 0) {
                        $('#message-field').find('.error').html('<p class="alert alert-danger">' + data.message + '</p>');
                    }
                });
            });
        }
    }

};

},{"./contact.template.html":46}],46:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button active" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/contact.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/contact.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col" style="overflow: auto;">\n        <h1>{{ contact.title }}</h1>\n\n        <span v-html="contact.body"></span>\n\n        <form id="contact" action="/contact" method="POST" @submit="sendEmail">\n\n\n            <div class="form-group" id="name-field">\n                <label for="name">Name:</label>\n                <input class="form-control" name="name" id="name">\n                <div class="error"></div>\n            </div>\n\n            <div class="form-group">\n                <label for="phone">Phone:</label>\n                <input class="form-control" name="phone" id="phone">\n            </div>\n\n            <div class="form-group" id="email-field">\n                <label for="email">Email Address:</label>\n                <input class="form-control" name="email" id="email">\n                <div class="error"></div>\n            </div>\n\n            <div class="form-group" id="message-field">\n                <label for="message">Message:</label>\n                <textarea class="form-control" name="message" rows="7" id="message"></textarea>\n                <div class="error"></div>\n            </div>\n\n            <button class="btn btn-primary pull-right" type="submit">Send</button>\n        </form>\n\n    </div>\n</div>';
},{}],47:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./contraindications.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/contraindications', function (data, status, request) {

            // set data on vm
            this.$set('contraindications', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'contraindications': ''
        };
    }

};

},{"./contraindications.template.html":48}],48:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button active" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/contraindications.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/contraindications.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ contraindications.title }}</h1>\n\n        <div id="copy">\n            <div id="scroll">\n                <span v-html="contraindications.body"></span>\n            </div>\n        </div>\n\n    </div>\n</div>';
},{}],49:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./first-time-clients.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/first-time-clients', function (data, status, request) {

            // set data on vm
            this.$set('first', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'first': ''
        };
    }

};

},{"./first-time-clients.template.html":50}],50:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button active" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/new_client.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/new_client.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ first.title }}</h1>\n\n        <div id="copy">\n            <div id="scroll">\n                <span v-html="first.body"></span>\n            </div>\n        </div>\n\n        <br/>\n        <button type="button" data-href="/pdfs/first_time_client.pdf" class="btn btn-primary btn-sm download">first-time clients</button>\n        <button type="button" data-href="/pdfs/physician_permission.pdf" class="btn btn-primary btn-sm download">physician permission</button>\n        <button type="button" data-href="/pdfs/physician_referral.pdf" class="btn btn-primary btn-sm download">physician referral</button>\n\n    </div>\n</div>';
},{}],51:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./home.template.html')

};

},{"./home.template.html":52}],52:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button active" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/fire.jpg" />\n    </div>\n    <div class="col-md-4 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/fire.jpg" />\n    </div>\n    <div class="col-md-5 col-xs-12 right-col front-page">\n        <p id="modalities">massage therapy & related bodywork modalities to assist you on your journey to restore wellness to your life</p>\n        <p id="address">1640 east thomas road<br/>back building<br/>phoenix, arizona 85016</p>\n    </div>\n</div>';
},{}],53:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./links.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/links', function (data, status, request) {

            // set data on vm
            this.$set('links', data.links);
            this.$set('page', data.page);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'links': '',
            'page': ''
        };
    }

};

},{"./links.template.html":54}],54:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button active" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/links.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/links.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ page.title }}</h1>\n\n        <ul style="list-style-type:  none;">\n            <li v-for="link in links">\n                <h2>{{ link.title }}</h2>\n                <span v-html="link.description"></span>\n                <p style="margin: 10px 0;"><a href="{{ link.link }}" target="_blank" rel="nofollow">Visit Site</a>\n\n            </li>\n        </ul>\n\n    </div>\n</div>';
},{}],55:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./location.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/location', function (data, status, request) {

            // set data on vm
            this.$set('location', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'location': ''
        };
    },

    ready: function ready() {
        this.initialize();
    },

    methods: {

        initialize: function initialize() {
            var mapOptions = {
                center: new google.maps.LatLng(33.480458, -112.045939),
                zoom: 16,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            var map = new google.maps.Map(document.getElementById("map"), mapOptions);

            var rbwmt = new google.maps.Marker({
                position: new google.maps.LatLng(33.480458, -112.045939),
                draggable: false
            });

            rbwmt.setMap(map);

            var infowindow = new google.maps.InfoWindow();

            var rbwmtInfo = {
                company: 'restoration bodywork and massage therapy',
                address: '1640 east thomas road, back building',
                city: 'phoenix',
                state: 'az',
                zip: '85016',
                phone: '602.695.0809',
                website: 'restoratiobodyworkaz.com',
                image: 'restoration_logo.png'
            };

            infowindow.setContent(this.infowindowContent(rbwmtInfo));

            infowindow.open(map, rbwmt);
        },

        infowindowContent: function infowindowContent(info) {

            var html;

            html = '<h3><a href="http://www.' + info.website + '" target="_blank" rel="nofollow"><img src="/images/' + info.image + '" width="100"/></a></h3>';
            html += '<p style="margin-bottom:1px;">' + info.address + '</p>';
            html += '<p style="margin-bottom:1px;">' + info.city + ' ' + info.state + ' ' + info.zip + '</p>';
            html += '<p style="margin-bottom:1px;">' + info.phone + '</p>';

            return html;
        }
    }

};

},{"./location.template.html":56}],56:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button active" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/water2.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/water2.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ location.title }}</h1>\n\n        <span v-html="location.body"></span>\n\n        <div id="map" style="width:100%; height:410px;"></div>\n    </div>\n</div>';
},{}],57:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./modalities.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/modalities', function (data, status, request) {

            // set data on vm
            this.$set('modalities', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'modalities': ''
        };
    }

};

},{"./modalities.template.html":58}],58:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button active" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/modalities.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/modalities.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ modalities.title }}</h1>\n\n        <div id="copy">\n            <div id="scroll">\n                <span v-html="modalities.body"></span>\n            </div>\n        </div>\n\n    </div>\n</div>';
},{}],59:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./policies.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/policies', function (data, status, request) {

            // set data on vm
            this.$set('policies', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'policies': ''
        };
    }

};

},{"./policies.template.html":60}],60:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button active" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/policies.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/policies.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ policies.title }}</h1>\n\n        <span v-html="policies.body"></span>\n\n    </div>\n</div>';
},{}],61:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./rates.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/rates', function (data, status, request) {

            // set data on vm
            this.$set('rates', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'rates': ''
        };
    }

};

},{"./rates.template.html":62}],62:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button active" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/rates.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/rates.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ rates.title }}</h1>\n\n        <div id="copy">\n            <div id="scroll">\n                <span v-html="rates.body"></span>\n            </div>\n        </div>\n\n    </div>\n</div>';
},{}],63:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./thank-you.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/thank-you', function (data, status, request) {

            // set data on vm
            this.$set('thanks', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'thanks': ''
        };
    }

};

},{"./thank-you.template.html":64}],64:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button active" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/water2.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/water2.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ thanks.title }}</h1>\n\n        <span v-html="thanks.body"></span>\n\n    </div>\n</div>';
},{}],65:[function(require,module,exports){
'use strict';

module.exports = {

    template: require('./therapeutic-benefits.template.html'),

    data: function data() {

        // GET request
        this.$http.get('/therapeutic-benefits', function (data, status, request) {

            // set data on vm
            this.$set('therapeutic', data);
        }).error(function (data, status, request) {
            // handle error
        });

        return {
            'therapeutic': ''
        };
    }

};

},{"./therapeutic-benefits.template.html":66}],66:[function(require,module,exports){
module.exports = '<div>\n    <div class="visible-xs">\n        <div class="navbar navbar-inverse navbar-fixed-top" role="banner">\n            <div class="navbar-header">\n                <button class="navbar-toggle" type="button" data-toggle="collapse" data-target=".bs-navbar-collapse">\n                    <span class="sr-only">Toggle navigation</span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                    <span class="icon-bar"></span>\n                </button>\n                <a v-link.literal="/" class="navbar-brand">restoration bodywork</a>\n            </div>\n            <div class="collapse navbar-collapse bs-navbar-collapse" role="navigation">\n                <ul class="nav navbar-nav">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </div>\n        </div>\n\n    </div>\n    <div class="visible-sm hidden-xs hidden-md hidden-lg">\n        <ul class="nav nav-tabs" style="border:none;">\n            <li class="dropdown" >\n                <a class="dropdown-toggle" data-toggle="dropdown" v-link.literal="#" style="background-color:#952C41;">\n                    restoration bodywork <span class="caret"></span>\n                </a>\n                <ul class="dropdown-menu">\n                    <li class="button"><a v-link.literal="/">home</a></li>\n                    <li class="button"><a v-link.literal="/about">about us</a></li>\n                    <li class="button"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button"><a v-link.literal="/location">location</a></li>\n                    <li class="button"><a v-link.literal="/links">links</a></li>\n                    <li class="button"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </li>\n        </ul>\n    </div>\n\n    <div class="col-md-3 hidden-sm hidden-xs left-col">\n        <div id="logo">\n            <img class="img-responsive" src="/images/restoration_logo.png" alt="Restoration Body Work and Massage Therapy" />\n        </div>\n\n        <div class="hidden-xs">\n            <nav>\n                <ul class="nav nav-pills nav-stacked">\n                    <li class="button" data-nav=""><a v-link.literal="/">home</a></li>\n                    <li class="button" data-nav="about"><a v-link.literal="/about">about us</a></li>\n                    <li class="button active" data-nav="therapeutic-benefits"><a v-link.literal="/therapeutic-benefits">therapeutic benefits</a></li>\n                    <li class="button" data-nav="contraindications"><a v-link.literal="/contraindications">contraindications</a></li>\n                    <li class="button" data-nav="modalities"><a v-link.literal="/modalities">modalities</a></li>\n                    <li class="button" data-nav="first-time-clients"><a v-link.literal="/first-time-clients">first-time clients</a></li>\n                    <li class="button" data-nav="policies"><a v-link.literal="/policies">policies</a></li>\n                    <li class="button" data-nav="location"><a v-link.literal="/location">location</a></li>\n                    <li class="button" data-nav="links"><a v-link.literal="/links">links</a></li>\n                    <li class="button" data-nav="rates"><a v-link.literal="/rates">our rates</a></li>\n                    <li class="button" data-nav="contact"><a v-link.literal="/contact">contact us</a></li>\n                </ul>\n            </nav>\n        </div>\n    </div>\n    <div class="col-md-3 col-xs-12 hidden-md hidden-lg image-slice">\n        <img src="/images/centerpieces/therapeutic.jpg" />\n    </div>\n    <div class="col-lg-3 col-md-3 col-xs-12 hidden-sm hidden-xs center-col">\n        <img src="/images/centerpieces/therapeutic.jpg" />\n    </div>\n    <div class="col-lg-6 col-md-6 col-xs-12 right-col">\n        <h1>{{ therapeutic.title }}</h1>\n\n        <div id="copy">\n            <div id="scroll">\n                <span v-html="therapeutic.body"></span>\n            </div>\n        </div>\n\n    </div>\n</div>';
},{}]},{},[39]);
