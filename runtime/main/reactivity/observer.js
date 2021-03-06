/* eslint-disable */

import Dep from './dep';
import { arrayMethods } from './array';
import {
  def,
  remove,
  isObject,
  isPlainObject,
  hasOwn,
  isReserved
} from '../../utils/index.ts';

const arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * <p>Observer class that are attached to each observed object.</p>
 * <p>Once attached, the observer converts target object's property keys<br>
 * into getter/setters that collect dependencies and dispatches updates.</p>
 * @param {Array|Object} value
 * @constructor
 */
export function Observer (value) {
  this.value = value;
  this.dep = new Dep();
  def(value, '__ob__', this)
  if (Array.isArray(value)) {
    copyAugment(value, arrayMethods, arrayKeys);
    this.observeArray(value);
  } else {
    this.walk(value);
  }
}

// Instance methods

/**
 * <p>Walk through each property and convert them into getter/setters.</p>
 * <p>This method should only be called when value type is Object.</p>
 * @param {Object} obj
 */
Observer.prototype.walk = function (obj) {
  for (let key in obj) {
    this.convert(key, obj[key]);
  }
}

/**
 * Observe a list of Array items.
 * @param {Array} items
 */
Observer.prototype.observeArray = function (items) {
  for (let i = 0, l = items.length; i < l; i++) {
    observe(items[i]);
  }
}

/**
 * Convert a property into getter/setter so we can emit the events when the property is accessed/changed.
 * @param {String} key
 * @param {*} val
 */
Observer.prototype.convert = function (key, val) {
  defineReactive(this.value, key, val);
}

/**
 * <p>Add an owner vm, so that when $set/$delete mutations<br>
 * happen we can notify owner vms to proxy the keys and digest the watchers.</p>
 * <p>This is only called when the object is observed as a page's root $data.</p>
 * @param {Vue} vm
 */
Observer.prototype.addVm = function (vm) {
  (this.vms || (this.vms = [])).push(vm);
}

/**
 * Remove an owner vm. This is called when the object is swapped out as a page's $data object.
 * @param {Vue} vm
 */
Observer.prototype.removeVm = function (vm) {
  remove(this.vms, vm);
}

/**
 * Augment an target Object or Array by defining hidden properties.
 * @param {Object|Array} target
 * @param {Object} proto
 */
function copyAugment (target, src, keys) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * <p>Attempt to create an observer page for a value,<br>
 * returns the new observer if successfully observed,<br>
 * or the existing observer if the value already has one.<p>
 * @param {*} value
 * @param {Vue} [vm]
 * @return {Observer|undefined}
 * @static
 */
export function observe (value, vm) {
  if (!isObject(value)) {
    return;
  }
  let ob;
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else if (
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value);
  }
  if (ob && vm) {
    ob.addVm(vm);
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 */
export function defineReactive (obj, key, val) {
  const dep = new Dep();
  const property = Object.getOwnPropertyDescriptor(obj, key);
  if (property && property.configurable === false) {
    return;
  }

  // Cater for pre-defined getter/setters.
  const getter = property && property.get;
  const setter = property && property.set;

  let childOb = observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val;
      if (Dep.target) {
        dep.depend();
        if (childOb) {
          childOb.dep.depend();
        }
        if (Array.isArray(value)) {
          for (let e, i = 0, l = value.length; i < l; i++) {
            e = value[i];
            e && e.__ob__ && e.__ob__.dep.depend();
          }
        }
      }
      return value;
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val;
      if (newVal === value) {
        return;
      }
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      childOb = observe(newVal);
      dep.notify();
    }
  })
}

/**
 * <p>Set a property on an object.</p>
 * <p>Adds the new property and triggers change notification if the property doesn't already exist.</p>
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 * @public
 */
export function set (obj, key, val) {
  if (Array.isArray(obj)) {
    return obj.splice(key, 1, val);
  }
  if (hasOwn(obj, key)) {
    obj[key] = val;
    return;
  }
  if (obj._isVue) {
    set(obj._data, key, val);
    return;
  }
  const ob = obj.__ob__;
  if (!ob) {
    obj[key] = val;
    return;
  }
  ob.convert(key, val);
  ob.dep.notify();
  if (ob.vms) {
    let i = ob.vms.length;
    while (i--) {
      const vm = ob.vms[i];
      proxy(vm, key);
    }
  }
  return val
}

/**
 * Delete a property and trigger change if necessary.
 * @param {Object} obj
 * @param {String} key
 */
export function del (obj, key) {
  if (!hasOwn(obj, key)) {
    return;
  }
  delete obj[key];
  const ob = obj.__ob__;
  if (!ob) {
    if (obj._isVue) {
      delete obj._data[key];
    }
    return;
  }
  ob.dep.notify();
  if (ob.vms) {
    let i = ob.vms.length;
    while (i--) {
      const vm = ob.vms[i];
      unproxy(vm, key);
    }
  }
}

// Add $item ,modify $index to $idx.
const KEY_WORDS = ['$idx', '$value', '$event','$item']
export function proxy (vm, key, segment) {
  segment = segment || vm._data;
  if (KEY_WORDS.indexOf(key) > -1 || !isReserved(key)) {
    Object.defineProperty(vm, key, {
      configurable: true,
      enumerable: true,
      get: function proxyGetter () {
        return segment[key];
      },
      set: function proxySetter (val) {
        segment[key] = val;
      }
    })
  }
}

export function unproxy (vm, key) {
  if (!isReserved(key)) {
    delete vm[key];
  }
}
