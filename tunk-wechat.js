var apply = require('apply.js');

(function () {

    var connections = [];
    var _hidden = true;

    function wechat(utils) {
        var tunk = this;

        wechat.App = function (obj) {
            _hidden = false;
            App(connect(obj, this, 'app'));
        };

        wechat.Page = function (obj) {
            Page(connect(obj, this, 'page'));
        };

        // wechat.Component = function (obj) {
        //     Component(connect(obj, this, 'component'));
        // };

        utils.hook('setState', function (origin) {
            return function (newState, options) {
                var pipes = connections[options.moduleName],
                    changedFields = Object.keys(newState),
                    statePath;

                origin(newState, options);

                setTimeout(function () {
                    if (pipes && pipes.length) for (var i = 0, l = pipes.length; i < l; i++) if (pipes[i]) {
                        statePath = pipes[i].statePath;
                        // 只更新 changedFields 字段
                        if (statePath[1] && changedFields.indexOf(statePath[1]) === -1) continue;
                        //减少克隆次数，分发出去到达 View 的数据用同一个副本，减少调用 hooks.getState
                        (function (targetObject, propName, newValue, options) {
                            if(targetObject._hidden_) return;
                            var tmp = {};
                            tmp[propName] = newValue;
                            targetObject.setData(tmp);
                        })(pipes[i].comp, pipes[i].propName, utils.hooks.getState(statePath, options), options);
                    }
                });
            }
        });

        /**
         * 
         * @param {*} obj: Object 
         * @param {*} context 
         * @param {*} type: String = ['app', 'page', 'component']
         */
        function connect(obj, context, type) {

            var onLoad = obj.onLoad;
            var onUnload = obj.onUnload
            var onShow = obj.onShow
            var onHide = obj.onHide
            var attached = obj.attached
            var detached = obj.detached

            var data = obj.data = obj.data || {};
            var state = obj.state;
            var actions = obj.actions;

            if(actions && typeof actions === 'object'){
                for(var x in actions){
                    if(actions[x] && typeof actions[x] === 'string' && actions[x].indexOf('.') > -1) {
                        (function(action){
                            obj[x] = function () {
                                utils.dispatchAction(action[0], action[1], arguments)
                            }
                        })(actions[x].split('.'));
                    }else {
                        throw '[tunk-wechat]:the action value should be like "moduleName.actionName"';
                    }
                }
            }

            obj.dispatch = function (actionPath) {
                if (typeof actionPath !== 'string' || actionPath.indexOf('.') === -1) throw '[tunk-wechat]:the first argument should has dot between module name and action name: ' + actionPath;
                actionPath = actionPath.split('.');
                return utils.dispatchAction(actionPath[0], actionPath[1], Array.prototype.slice.call(arguments, 1));
            }

            if(type === 'page'){

                _defineStateData(state, data);

                obj.onShow = function() {
                    console.log('obj.onShow', this.data.cd);
                    this._hidden_ = false;
                    _refreshState(state, this);
                    console.log('obj.onShow', this.data.cd);
                    if (onShow) apply(onShow, arguments, this);
                };

                obj.onHide = function() {
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

                var onLaunch = obj.onLaunch;
                obj.onLaunch = function () {
                    return apply(onLaunch, arguments, this);
                };

                obj.onShow = function(){
                    _hidden = false;
                    if (onShow) apply(onShow, arguments, this);
                };

                obj.onHide = function(){
                    _hidden = true;
                    if (onHide) apply(onHide, arguments, this);
                };

            } else if(type === 'component') {

                _defineStateData(state, data);

                obj.attached = function () {
                    _initState(state, this);
                    if (onLoad) apply(onLoad, arguments, this);
                    console.log('obj.attached', this);
                    
                };

                obj.detached = function () {
                    _disconnect(this);
                    if (onUnload) apply(onUnload, arguments, this);
                };
            }

            return obj;
        }

        function _defineStateData(state, data){
            if (state && typeof state === 'object') {
                for (var x in state) if (state.hasOwnProperty(x)) {
                    data[x] = null;
                }
            }
        }
        function _initState(state, context){
            var tmp = {}; 
            if (state && typeof state === 'object') {
                for (var x in state) if (state.hasOwnProperty(x)) {
                    tmp[x] = _connectState(context, x, state[x].split('.'));
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

        function _refreshState(state, context){
            var tmp = {}; 
            var statePath;
            if (state && typeof state === 'object') {
                for (var x in state) if (state.hasOwnProperty(x)) {
                    statePath = state[x].split('.');
                    tmp[x] = utils.hooks.getState(statePath, utils.modules[statePath[0]].options);
                }
            }
            context.setData(tmp);
        }

        function _disconnect(context){
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
