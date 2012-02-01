function xmlmatch_test_main () {
    with (xmlmatch) {
        var elem = E_ ("root", {},
                       E_ ("c1", {}, "cont c1"),
                       E_ ("c2", {}, "cont c2"),
                       E_ ("c3", {},
                           E_ ("c31", {}, "cont c31"),
                           E_ ("c32", {}, "cont c32"))) (document);

        console.debug (elem);

        var eat_root =
            M ("root",
               C (M ("c1", function (c) {console.assert (c.textContent == "cont c1"); return true}),
                  M ("c2"),
                  M ("c3", concat (M ("c31", function (c) {console.debug (c); return true;}),
                                   M ("c32", function (c) {console.debug (c); return true;})))));

        var ret = eat_root (elem);

        console.debug ("done", ret);
    }
}

xmlmatch = {};

xmlmatch.alter = function () {
    var options = arguments;

    return function (c) {
        for (var i = 0; i < options.length; i ++) {
            var p = options[i];
            if (p (c)) {
                return true;
            }
        }

        return false;
    };
};

xmlmatch.concat = function () {
    var seq = arguments;

    return function (elem) {
        for (var c = elem.firstChild, i = 0; i < seq.length; c = c.nextSibling, i ++) {
            if (! seq[i] (c))
                return false;
        }
        return true;
    };
};

xmlmatch.star = function (p) {
    return function (elem) {
        for (var c = elem.firstChild; c; c = c.nextSibling) {
            if (! p (c))
                return false;
        }

        return true;
    }
};

xmlmatch.children = function () {
    return xmlmatch.star (xmlmatch.alter.apply (this, arguments));
};

xmlmatch.matcher = function (tagname) {
    var procs = arguments;
    return function (e) {
        if (e.nodeName.toLowerCase () != tagname) {
            // console.debug (e.nodeName.toLowerCase (), "!=", tagname);

            return false;
        }

        // console.debug ("eating " + tagname);

        for (var i = 1; i < procs.length; i ++) {
            var p = procs[i];
            if (p) {
                var ret = p (e);
                if (! ret)
                    return false;
            }
        }

        return true;
    }
};

xmlmatch.M = xmlmatch.matcher;
xmlmatch.C = xmlmatch.children;
