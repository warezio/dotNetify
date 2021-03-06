/* 
Copyright 2017-2018 Dicky Suryadi

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */
import utils from '../libs/utils';

export default class dotnetifyVMRouter {
  routes = [];

  get RoutingState() {
    throw new Error('Not implemented');
  }
  get VMRoot() {
    throw new Error('Not implemented');
  }
  get VMArg() {
    throw new Error('Not implemented');
  }

  constructor(vm, router) {
    this.vm = vm;
    this.router = router;
    this.debug = vm.$dotnetify.controller.debug;
  }

  // Dispatch the active routing state to the server.
  dispatchActiveRoutingState(iPath) {
    this.vm.$dispatch({ 'RoutingState.Active': iPath });
    let { RoutingState } = this.vm.State();
    RoutingState = Object.assign(RoutingState || {}, { Active: iPath });
    this.vm.State({ RoutingState });
  }

  // Handles click event from anchor tags.  Argument can be event object or path string.
  handleRoute(iArg) {
    let path = null;
    if (typeof iArg === 'object') {
      iArg.preventDefault();
      path = iArg.currentTarget.pathname;
    }
    else if (typeof iArg === 'string') path = iArg;

    if (path == null || path == '') throw new Error('$handleRoute requires path argument or event with pathname.');
    setTimeout(() => this.router.pushState({}, '', path));
  }

  // Build the absolute root path from the "vmRoot" property on React component.
  initRoot() {
    if (!this.hasRoutingState || this.RoutingState === null || this.RoutingState.Root === null) return;

    if (this._absRoot != this.RoutingState.Root) {
      var absRoot = utils.trim(this.VMRoot);
      if (absRoot != '') absRoot = '/' + absRoot;
      var root = utils.trim(this.RoutingState.Root);
      this._absRoot = root != '' ? absRoot + '/' + root : absRoot;
      this.RoutingState.Root = this._absRoot;
    }
  }

  // Initialize routing templates if the view model implements IRoutable.
  initRouting() {
    const vm = this.vm;
    if (!this.hasRoutingState) return;

    if (this.RoutingState === null) {
      console.error("router> the RoutingState prop of '" + vm.$vmId + "' was not initialized.");
      return;
    }

    var templates = this.RoutingState.Templates;
    if (templates == null || templates.length == 0) return;

    // Initialize the router.
    if (!this.router.$init) {
      this.router.init();
      this.router.$init = true;
    }

    // Build the absolute root path.
    this.initRoot();

    templates.forEach(template => {
      // If url pattern isn't given, consider Id as the pattern.
      var urlPattern = template.UrlPattern != null ? template.UrlPattern : template.Id;
      urlPattern = urlPattern != '' ? urlPattern : '/';
      var mapUrl = this.toUrl(urlPattern);

      if (this.debug) console.log('router> map ' + mapUrl + ' to template id=' + template.Id);

      this.router.mapTo(mapUrl, iParams => {
        this.router.urlPath = '';

        // Construct the path from the template pattern and the params passed by PathJS.
        var path = urlPattern;
        for (var param in iParams) path = path.replace(':' + param, iParams[param]);
        path = path.replace(/\(\/:([^)]+)\)/g, '').replace(/\(|\)/g, '');

        this.routeTo(path, template);
      });
    });

    // Route initial URL.
    var activeUrl = this.toUrl(this.RoutingState.Active);
    if (this.router.urlPath == '') this.router.urlPath = activeUrl;
    if (!this.routeUrl())
      // If routing ends incomplete, raise routed event anyway.
      this.raiseRoutedEvent(true);
  }

  // Whether a route is active.
  isActive(iRoute) {
    if (iRoute != null && iRoute.hasOwnProperty('Path')) {
      return utils.equal(iRoute.Path, this.RoutingState.Active);
    }
    return false;
  }

  // Loads a view into a target element.
  loadView(iTargetSelector, iViewUrl, iJsModuleUrl, iVmArg, iCallbackFn) {
    throw new Error('Not implemented');
  }

  // Routes to a path.
  manualRouteTo(iPath, iTarget, iViewUrl, iJSModuleUrl) {
    const vm = this.vm;
    var template = { Id: 'manual', Target: iTarget, ViewUrl: iViewUrl, JSModuleUrl: iJSModuleUrl };
    this.routeTo(iPath, template, true);
  }

  // Handles route enter event.
  onRouteEnter(iPath, iTemplate) {
    return true;
  }

  // Raise event indicating the routing process has ended.
  raiseRoutedEvent(force) {
    const vm = this.vm;
    if (this.router.urlPath == '' || force == true) {
      if (this.debug) console.log('router> routed');
      utils.dispatchEvent('dotnetify.routed');
    }
  }

  // Returns the URL for an anchor tag.
  route(iRoute, iTarget) {
    // No route to process. Return silently.
    if (iRoute == null) return;

    if (!iRoute.hasOwnProperty('Path') || !iRoute.hasOwnProperty('TemplateId')) throw new Error('Not a valid route');

    // Build the absolute root path.
    this.initRoot();

    // If the route path is not defined, use the URL pattern from the associated template.
    // This is so that we don't send the same data twice if both are equal.
    var path = iRoute.Path;
    var template = null;
    if (this.hasRoutingState && this.RoutingState.Templates != null) {
      var match = this.RoutingState.Templates.filter(function(iTemplate) {
        return iTemplate.Id == iRoute.TemplateId;
      });
      if (match.length > 0) {
        template = match[0];

        if (typeof iTarget === 'string') template.Target = iTarget;

        if (path == null) {
          path = template.UrlPattern != null ? template.UrlPattern : template.Id;
          iRoute.Path = path;
        }
      }
      else if (iRoute.RedirectRoot == null) throw new Error("vmRoute cannot find route template '" + iRoute.TemplateId);
    }

    // If the path has a redirect root, the path doesn't belong to the current root and needs to be
    // redirected to a different one.  Set the absolute path to the HREF attribute, and prevent the
    // default behavior of the anchor click event and instead do push to HTML5 history state, which
    // would attempt to resolve the path first before resorting to hard browser redirect.
    if (iRoute.RedirectRoot != null) {
      // Combine the redirect root with the view model's root.
      var redirectRoot = iRoute.RedirectRoot;
      if (redirectRoot.charAt(0) == '/') redirectRoot = redirectRoot.substr(0, redirectRoot.length - 1);
      var redirectRootPath = iRoute.RedirectRoot.split('/');

      var urlRedirect = '';
      var absRoot = this.VMRoot;
      if (absRoot != null) {
        var absRootPath = absRoot.split('/');
        for (var i = 0; i < absRootPath.length; i++) {
          if (absRootPath[i] != '' && absRootPath[i] == redirectRootPath[0]) break;
          urlRedirect += absRootPath[i] + '/';
        }
      }
      urlRedirect += redirectRoot + '/' + path;
      this.routes.push({ Path: path, Url: urlRedirect });
      return urlRedirect;
    }

    // For quick lookup, save the mapping between the path to the route inside the view model.
    if (template == null) throw new Error('vmRoute cannot find any route template');

    iRoute.$template = template;
    this.pathToRoute = this.pathToRoute || {};
    this.pathToRoute[path] = iRoute;

    // Set the absolute path to the HREF attribute, and prevent the default behavior of
    // the anchor click event and instead do push to HTML5 history state.
    let url = this.toUrl(path);
    url = url.length > 0 ? url : '/';
    this.routes.push({ Path: path, Url: url });
    return url;
  }

  // Routes to a path.
  routeTo(iPath, iTemplate, iDisableEvent, iCallbackFn, isRedirect) {
    const vm = this.vm;
    const viewModels = vm.$dotnetify.getViewModels();

    if (this.debug) console.log("router> route '" + iPath + "' to template id=" + iTemplate.Id);

    // We can determine whether the view has already been loaded by matching the 'RoutingState.Origin' argument
    // on the existing view model inside that target selector with the path.
    for (let i = 0; i < viewModels.length; i++) {
      var vmOther = viewModels[i];
      var vmArg = vmOther.$router.VMArg;
      if (vmArg != null) {
        if (typeof vmArg['RoutingState.Origin'] === 'string' && utils.equal(vmArg['RoutingState.Origin'], iPath)) return;
      }
    }

    // Support enter interception.
    if (iDisableEvent != true && vm.hasOwnProperty('onRouteEnter')) {
      if (this.onRouteEnter(iPath, iTemplate) == false || vm.onRouteEnter(iPath, iTemplate) == false) return;
    }

    // Check if the route has valid target.
    if (iTemplate.Target === null) {
      console.error("router> the Target for template '" + iTemplate.Id + "' was not set.  Use vm.onRouteEnter() to set the target.");
      return;
    }

    // If target DOM element isn't found, redirect URL to the path.
    if (document.getElementById(iTemplate.Target) == null) {
      if (isRedirect === true) {
        if (this.debug) console.log("router> target '" + iTemplate.Target + "' not found in DOM");
        return;
      }
      else {
        if (this.debug) console.log("router> target '" + iTemplate.Target + "' not found in DOM, use redirect instead");
        return this.router.redirect(this.toUrl(iPath), viewModels);
      }
    }

    // Load the view associated with the route asynchronously.
    this.loadView('#' + iTemplate.Target, iTemplate.ViewUrl, iTemplate.JSModuleUrl, { 'RoutingState.Origin': iPath }, () => {
      // If load is successful, update the active route.
      this.dispatchActiveRoutingState(iPath);

      // Support exit interception.
      if (iDisableEvent != true && vm.hasOwnProperty('onRouteExit')) vm.onRouteExit(iPath, iTemplate);

      if (typeof iCallbackFn === 'function') iCallbackFn.call(vm);
    });
  }

  routeToRoute(iRoute) {
    var path = this.vm.$route(iRoute);
    if (path == null || path == '') throw new Error('The route passed to $routeTo is invalid.');

    setTimeout(() => this.router.pushState({}, '', path));
  }

  // Routes the URL if the view model implements IRoutable.
  // Returns true if the view model handles the routing.
  routeUrl(isRedirect) {
    if (!this.hasRoutingState) return false;

    var root = this.RoutingState.Root;
    if (root == null) return false;

    // Get the URL path to route.
    var urlPath = this.router.urlPath;

    if (this.debug) console.log('router> routing ' + urlPath);

    // If the URL path matches the root path of this view, use the template with a blank URL pattern if provided.
    if (utils.equal(urlPath, root) || utils.equal(urlPath, root + '/') || urlPath === '/') {
      var match = utils.grep(this.RoutingState.Templates, function(iTemplate) {
        return iTemplate.UrlPattern === '';
      });
      if (match.length > 0) {
        this.routeTo('', match[0], null, null, isRedirect);
        this.router.urlPath = '';
        this.raiseRoutedEvent();
        return true;
      }
      return false;
    }

    // If the URL path starts with the root path of this view, look at the next path and try to match it with the
    // anchor tags in this view that are bound with the vmRoute binding type.  If there is match, route to that path.
    root = root + '/';
    if (utils.startsWith(urlPath, root)) {
      var routeElem = null;
      var match = utils.grep(this.routes, function(elem) {
        return utils.startsWith(urlPath + '/', elem.Url + '/');
      });
      if (match.length > 0) {
        // If more than one match, find the best match.
        for (var i = 0; i < match.length; i++) if (routeElem == null || routeElem.Url.length < match[i].Url.length) routeElem = match[i];
      }

      if (routeElem != null) {
        var path = routeElem.Path;
        var template =
          this.hasOwnProperty('pathToRoute') && this.pathToRoute.hasOwnProperty(path) ? this.pathToRoute[path].$template : null;
        if (template != null) {
          // If the URL path is completely routed, clear it.
          if (utils.equal(this.router.urlPath, this.toUrl(path))) this.router.urlPath = '';

          // If route's not already active, route to it.
          if (!utils.equal(this.RoutingState.Active, path)) {
            this.routeTo(path, template, false, () => this.raiseRoutedEvent(), isRedirect);
          }
          else this.raiseRoutedEvent();
          return true;
        }
      }
      else if (this.router.match(urlPath)) {
        // If no vmRoute binding matches, try to match with any template's URL pattern.
        this.router.urlPath = '';
        this.raiseRoutedEvent();
        return true;
      }
    }
    return false;
  }

  // Builds an absolute URL from a path.
  toUrl(iPath) {
    let path = utils.trim(iPath);
    if (path.charAt(0) != '(' && path != '') path = '/' + path;
    return this.hasRoutingState ? this.RoutingState.Root + path : iPath;
  }
}
