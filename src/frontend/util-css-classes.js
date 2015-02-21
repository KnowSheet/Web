'use strict';

var $ = require('jquery');

/**
 * Converts an array, object to a string intended to be used as CSS classes.
 * 
 * Examples:
    * ```javascript
         [ "css-class-1", "css-class-2" ] // -> "css-class-1 css-class-2"
```
    * ```javascript
         "   css-class-1   css-class-2  " // -> "css-class-1 css-class-2"
```
    * ```javascript
         {
             "css-class-1": true,
             "css-class-2": true,
             "css-class-3": false
         }
         // -> "css-class-1 css-class-2"
```
 * 
 * @param {string|Array.<string>|Object.<string,boolean>} 
 * @return {string}
 */
function makeStringFromOptions(cssClasses) {
	var cssClassesString = '';
	
	if ($.isArray(cssClasses)) {
		// [ "css-class-1", "css-class-2" ]
		cssClassesString = cssClasses.join(' ');
	}
	else if (typeof cssClasses === 'string' || cssClasses instanceof String) {
		// "css-class-1 css-class-2"
		cssClassesString = cssClasses;
	}
	else if ($.isPlainObject(cssClasses)) {
		// { "css-class-1": true, "css-class-2": true, "css-class-3": false }
		$.each(cssClasses, function (k, v) {
			if (k && v === true) {
				cssClassesString += ' ' + k;
			}
		});
	}
	
	cssClassesString = cssClassesString.replace(/\s+/g, ' ').replace(/(^\s+)|(\s+$)/g, '');
	
	return cssClassesString;
}

module.exports = makeStringFromOptions;
