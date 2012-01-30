// -*- indent-tabs-mode: nil -*-
// Works on both WSH and Gecko

function E_ (name, attrs) {
    var children = [];
    for (var i = 2; i < arguments.length; i ++) {
        children.push (arguments[i]);
    }
    return function (doc) {
        var elem = doc.createElement (name);
        if (attrs) {
            for (var at in attrs) {
                elem.setAttribute (at, attrs[at]);
            }
            for (var i = 0; i < children.length; i ++) {
                var c = children[i];
                var f = function (c) {
                    if (typeof (c) == "function") {
                        f (c (doc));
                    } else if (typeof (c) == "object" && c.tagName) { // Element
                        elem.appendChild (c);
                    } else if (typeof (c) == "object" && c.length != null) { // Array
                        for (var i = 0; i < c.length; i ++) {
                            f (c[i]);
                        }
                    } else {
                        var cont = doc.createTextNode (c);
                        elem.appendChild (cont);
                    }
                }
                f (c);
            }
        }
        return elem;
    }
}

function test_WSH () {
    var doc = WScript.CreateObject ("MSXML.DOMDocument");
    var content = E_ ("root", {abc: "1234"}, E_ ("hoge", {}, "text"));
    doc.appendChild (content (doc));

    WScript.echo (doc.xml);
}

//test_WSH ();
