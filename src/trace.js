(function() {

    function testtrace()
    {
        function TestClass(prefix)
        {
            this.prefix = prefix;
        }

        TestClass.prototype.toString = function() {
            return "TestClass("+this.prefix+")";
        }

        TestClass.prototype.fourth = trace(function fourth(index,a,b,c) {
            debug(this.prefix+": "+index+" "+a+" "+b+" "+c);
            if (index == 5) {
                var z = null;
                var y = z.nothing;
            }
        });

        TestClass.prototype.third = trace(function third(index,a,b,c) {
            this.fourth(index,a,b,c);
        });

        TestClass.prototype.second = trace(function second(index,a,b,c) {
            this.third(index,a,b,c);
        });

        TestClass.prototype.first = trace(function first(a,b,c) {
            for (var index = 0; index < 10; index++)
                this.second(index,a,b,c);
        });

        function Foo()
        {
        }

        function testException()
        {
            var tc = new TestClass("xxxxx");
            tc.first("one","two","three",new Foo());
        }

        testException = trace(testException);

        try {
            testException();
        }
        catch (e) {
            debug("e = "+e);
        }
    }

    // -----

    function valueString(arg)
    {
        try {
            if (typeof(arg) == "object") {
                var str = arg.toString();
                if (str == "[object Object]")
                    return "[object "+arg.constructor.name+"]";
                else
                    return str;
            }
            else if (typeof(arg) == "string") {
                return JSON.stringify(arg);
            }
            else {
                return arg;
            }
        }
        catch (e) {
            return "?"; // in case object or array element's toString() fails
        }
    }

    function stackEntryString(fun,args,thisObject)
    {
        var components = new Array();
        if ((thisObject != null) && (thisObject.constructor.name != null)) {
            components.push(thisObject.constructor.name+".");
        }
        components.push(fun.name+"(");
        for (var argno = 0; argno < args.length; argno++) {
            var arg = args[argno];
            if (argno > 0)
                components.push(",");
            components.push(valueString(arg));
        }
        components.push("): this = "+valueString(thisObject));
        return components.join("");
    }

    function trace(fun)
    {
        return function() {
            try {
                return fun.apply(this,arguments);
            }
            catch (e) {
                var error = e;
                if (!error.custom) {
                    error = new Error(e.toString()+"\n");
                    error.custom = true;
                }
                error.message += stackEntryString(fun,arguments,this)+"\n";
                throw error;
            }
        }
    }

    window.trace = trace;
    window.testtrace = testtrace;

})();
