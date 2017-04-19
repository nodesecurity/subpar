'use strict';

exports.deepKeys = function (obj, prefix = []) {

  const result = [];
  const keys = Object.keys(obj);

  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i];
    const ref = obj[key];
    if (typeof ref === 'object' &&
        ref !== null) {

      result.push(...exports.deepKeys(ref, prefix.concat(key)));
    }
    else {
      result.push(prefix.concat(key).join('.'));
    }
  }

  return result;
};
