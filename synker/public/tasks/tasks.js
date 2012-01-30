$(document).ready(function() {
    console.debug("hoge!")
    var ul = $("<ul>")
    $("body").append(ul)

    $.ajax({url: "/snapshot/",
            success: function(data, text_status, jqXHR) {
                console.debug(data, text_status, jqXHR)

                var root = data.firstChild
                var state_id = root.getAttribute("state_id")
                for (var child = root.firstChild; child; child = child.nextSibling) {
                    var obj = {}
                    for (var elem = child.firstChild; elem; elem = elem.nextSibling) {
                        var key = elem.getAttribute("key")
                        var val = elem.textContent
                        console.debug(key, val)
                        obj[key] = val
                    }
                    ul.append($("<li>").text("node " + obj.x + " = " + obj.y))
                }
            }})
})
