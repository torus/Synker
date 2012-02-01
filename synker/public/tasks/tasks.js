Tasks = function() {
}

$(document).ready(function() {
    console.debug("hoge!")
    var body = $("body")
    var ul = $("<ul>")
    body.append(ul)

    var ta = $("<textarea>")
    var form = $("<form>").append(ta).append($("<input type='submit'>"))
    body.append(form)
    form.submit(function(ev) {
        var mesg = ta.val()
        ta.val("")
        console.debug("submit", mesg, ev)
        send_message(mesg)
        return false
    })

    var tasks = new Tasks

    $.ajax({url: "/snapshot/",
            success: function(data, text_status, jqXHR) {
                console.debug(data, text_status, jqXHR)

                // var root = data.firstChild
                // var state_id = root.getAttribute("state_id")
                // for (var child = root.firstChild; child; child = child.nextSibling) {
                //     var obj = {}
                //     for (var elem = child.firstChild; elem; elem = elem.nextSibling) {
                //         var key = elem.getAttribute("key")
                //         var val = elem.textContent
                //         console.debug(key, val)
                //         obj[key] = val
                //     }
                //     ul.append($("<li>").text("node " + obj.state + " = " + obj.title))
                //     objs[child.getAttribute("object_id")] = obj
                // }

                tasks.match_snapshot_xml(data)

                console.debug(tasks)
            }})

    // xmlmatch_test_main ()
})

Tasks.prototype.match_snapshot_xml = function (data) {
    with (xmlmatch) {
        var mat =
            M("snapshot",
              function (e) {
                  var state_id = e.getAttribute("state_id")
                  console.debug("state_id", state_id)
                  return true
              },
              C((function () {
                  var obj = {prop: {}}
                  return M("object",
                           function (e) {
                               var objid = e.getAttribute("object_id")
                               obj.id = objid
                               console.debug("object_id", objid)
                               return true
                           },
                           C((function () {
                               return M("property",
                                        function (e) {
                                            var key = e.getAttribute("key")
                                            console.debug("key", key)
                                            return true
                                        })})()))})()))
        var res = mat(data.firstChild)
        console.debug("res", res)
    }
}

function send_message(mesg) {
    var e = E_("x", {},
               E_("updates", {},
                  E_("new_object", {object_id: Date.now() + "." +
                                    Math.floor(Math.random() * 10000000)},
                     E_("property", {key: "title"}, mesg),
                     E_("property", {key: "state"}, "todo"),
                     E_("property", {key: "created"}, Date.now()),
                     E_("property", {key: "modified"}, Date.now()))))
    var elem = e(document)
    var xml = elem.innerHTML

    var data = "update=" + encodeURI(xml)
    console.debug(data)

    $.ajax({url: "/push",
            type: "POST",
            data: data})
}
