var apply = require('apply.js');

(function () {

    var connections = [],
        _hidden = true;

    function wechat(utils) {
        var tunk = this;

        wechat.App = function (obj) {
            _hidden = false;
            App(connect(obj, this, 'app'));
        };

        wechat.Page = function (obj) {
            Page(connect(obj, this, 'page'));
        };

        utils.hook('setState', function (origin) {
            return function (newState, options) {
                var pipes = connections[options.moduleName],
                    changedFields = Object.keys(newState),
                    statePath;

                origin(newState, options);

                setTimeout(function () {
                    var stateChangeTargets = [];
                    if (pipes && pipes.length) for (var i = 0, l = pipes.length; i < l; i++) if (pipes[i]) {
                        statePath = pipes[i].statePath;
                        // 只更新 changedFields 字段
                        if (statePath[1] && changedFields.indexOf(statePath[1]) === -1) continue;
                        (function (targetObject, propName, newValue, options) {
                            if (targetObject._hidden_) {
                                targetObject._stateDataChanged_ = targetObject._stateDataChanged_ || [];
                                if (targetObject._stateDataChanged_.indexOf(propName) === -1) targetObject._stateDataChanged_.push(propName);
                            } else {
                                targetObject._state_ = targetObject._state_ || {};
                                if (stateChangeTargets.indexOf(targetObject) === -1) stateChangeTargets.push(targetObject);
                                targetObject._state_[propName] = newValue;
                            }
                        })(pipes[i].comp, pipes[i].propName, !pipes[i].comp._hidden_ && utils.hooks.getState(statePath, options), options);
                    }
                    for (var i = 0, l = stateChangeTargets.length; i < l; i++) if (!stateChangeTargets[i]._hidden_) {
                        _setState(stateChangeTargets[i]);
                    }
                });
            }
        });

        function connect(obj, context, type) {

            var onLoad = obj.onLoad;
            var onUnload = obj.onUnload
            var onShow = obj.onShow
            var onHide = obj.onHide

            var data = obj.data = obj.data || {};
            var state = obj.state;
            var actions = obj.actions;

            if (actions && typeof actions === 'object') {
                for (var x in actions) {
                    if (actions[x] && typeof actions[x] === 'string') {
                        if (actions[x].indexOf('.') > -1) {
                            (function (action) {
                                obj[x] = function () {
                                    utils.dispatchAction(action[0], action[1], arguments)
                                }
                            })(actions[x].split('.'));
                        }else {
                            var proto = _getModule(actions[x]).__proto__,
                                protoNames = Object.getOwnPropertyNames(proto);
                                obj[x] = {};
                            for (var i = 0, y = protoNames[0]; i < protoNames.length; i++ , y = protoNames[i]) if (proto[y].options) {
                                (function(target, moduleName, actionName){
                                    target[actionName] = function () {
                                        utils.dispatchAction(moduleName, actionName, arguments)
                                    };
                                })(obj[x], actions[x], y)
                            }
                        }
                    } else {
                        throw '[tunk-wechat]:the action value should be like "moduleName.actionName"';
                    }
                }
            }

            obj.dispatch = function (actionPath) {
                if (typeof actionPath !== 'string' || actionPath.indexOf('.') === -1) throw '[tunk-wechat]:the first argument should has dot between module name and action name: ' + actionPath;
                actionPath = actionPath.split('.');
                return utils.dispatchAction(actionPath[0], actionPath[1], Array.prototype.slice.call(arguments, 1));
            }

            if (type === 'page') {

                // 实时状态容器
                obj._state_ = {};

                if (state && typeof state === 'object') {
                    for (var x in state) if (state.hasOwnProperty(x)) {
                        state[x] = state[x].split('.');
                    }
                }

                //_defineStateData(state, data);

                obj.onShow = function () {
                    this._hidden_ = false;
                    _refreshState(this);
                    if (onShow) apply(onShow, arguments, this);
                };

                obj.onHide = function () {
                    this._hidden_ = true;
                    if (onHide) apply(onHide, arguments, this);
                };

                obj.onLoad = function () {
                    _initState(state, this);
                    if (onLoad) apply(onLoad, arguments, this);
                };

                obj.onUnload = function () {
                    _disconnect(this);
                    if (onUnload) apply(onUnload, arguments, this);
                };

            } else if (type === 'app') {

                // var onLaunch = obj.onLaunch;
                // obj.onLaunch = function () {
                //     return apply(onLaunch, arguments, this);
                // };

                // obj.onShow = function () {
                //     _hidden = false;
                //     if (onShow) apply(onShow, arguments, this);
                // };

                // obj.onHide = function () {
                //     _hidden = true;
                //     if (onHide) apply(onHide, arguments, this);
                // };
            }

            return obj;
        }

        function _defineStateData(state, data) {
            if (state && typeof state === 'object') {
                for (var x in state) if (state.hasOwnProperty(x)) {
                    data[x] = null;
                }
            }
        }
        function _initState(state, context) {
            var tmp = {};
            if (state && typeof state === 'object') {
                for (var x in state) if (state.hasOwnProperty(x)) {
                    tmp[x] = _connectState(context, x, state[x]);
                }
            }
            context.setData(tmp);
        }
        function _connectState(targetObject, propName, statePath) {
            if (!statePath[0] || !utils.modules[statePath[0]]) throw '[tunk-wechat]:unknown module name:' + statePath[0];
            connections[statePath[0]] = connections[statePath[0]] || [];
            connections[statePath[0]].push({
                comp: targetObject,
                propName: propName,
                statePath: statePath,
            });
            targetObject._tunkOptions_ = targetObject._tunkOptions_ || {};
            targetObject._tunkOptions_[propName] = statePath;
            //返回组件默认数据
            return utils.hooks.getState(statePath, utils.modules[statePath[0]].options);
        }

        function _setState(target) {
            var tmp = {};
            if (target.onBeforeSetState) {
                var res = target.onBeforeSetState(target._state_);
                if (res && typeof res !== 'object') throw '[tunk-wechat]:wrong data type from onBeforeSetState.';
                target.setData(res || target._state_);
            } else {
                target.setData(target._state_);
            }
            target._state_ = null;
        }
        function _refreshState(target) {
            var props = target._stateDataChanged_, statePath;
            if (props) {
                for (var i = 0, l = props.length; i < l; i++) {
                    statePath = target.state[props[i]];
                    target._state_[props[i]] = utils.hooks.getState(statePath, utils.modules[statePath[0]].options);
                }
                _setState(target);

                target._stateDataChanged_ = null;
            }
        }

        function _disconnect(context) {
            if (context._tunkOptions_) {
                var stateOption = context._tunkOptions_;
                var tmp;
                for (var x in stateOption) {
                    tmp = [];
                    for (var i = 0, l = connections[stateOption[x][0]].length; i < l; i++) {
                        if (connections[stateOption[x][0]][i].comp !== context) tmp.push(connections[stateOption[x][0]][i]);
                    }
                    connections[stateOption[x][0]] = tmp;
                }
            }
        }
        function _getModule(moduleName) {
            if (!utils.modules[moduleName]) throw '[tunk-wechat]:unknown module name ' + moduleName;
            return utils.modules[moduleName];
        }

    };




    if (typeof module === 'object' && module.exports) {
        module.exports = wechat;
    }
    else if (typeof define === 'function' && define.amd) {
        define(function () {
            return wechat;
        })
    }


})();
