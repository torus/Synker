Tasks = function() {
}

$(document).ready(function() {
    console.debug("hoge!")
    var body = $("body")
    var ul = $("<ul>")
    body.append(ul)

    var tasks = new Tasks

    var ta = $("<textarea>")
    var form = $("<form>").append(ta).append($("<input type='submit'>"))
    body.append(form)
    form.submit(function(ev) {
        var mesg = ta.val()
        ta.val("")
        console.debug("submit", mesg, ev)
        tasks.send_message(mesg)
        return false
    })

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
    var objects = {}

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
                               var key
                               return M("property",
                                        function (e) {
                                            key = e.getAttribute("key")
                                            console.debug("key", key)
                                            return true
                                        },
                                        C((function () {
                                            var list = []
                                            return M("object_list",
                                                     C(M("object_ref",
                                                         function (e) {
                                                             var id = e.getAttribute("object_id")
                                                             list.push(id)
                                                             return true
                                                         }),
                                                       function () {
                                                           obj.prop[key] = list
                                                           console.debug("list", list)
                                                           return true
                                                       }))})(),
                                          M("#text",
                                            function (e) {
                                                var t = e.textContent
                                                console.debug("#text", t)
                                                obj.prop[key] = t
                                                return true
                                            })))})()),
                           function () {
                               objects[obj.id] = obj
                               return true
                           })})()))
        this.objects = objects
        var res = mat(data.firstChild)
        console.debug("res", res)
    }
}

Tasks.prototype.send_message =  function (mesg) {
    var new_obj_elem = E_("new_object", {object_id: Date.now() + "." +
                                         Math.floor(Math.random() * 10000000)},
                          E_("property", {key: "title"}, mesg),
                          E_("property", {key: "state"}, "todo"),
                          E_("property", {key: "created"}, Date.now()),
                          E_("property", {key: "modified"}, Date.now()))
    var e = E_("x", {},
               E_("updates", {},
                  new_obj_elem
                  ))
    var elem = e(document)
    var xml = elem.innerHTML

    var data = "update=" + encodeURI(xml)
    console.debug(data)

    $.ajax({url: "/push",
            type: "POST",
            data: data})
}
