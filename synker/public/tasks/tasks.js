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

Tasks.prototype.parse_object_list = function (list) {
    with (xmlmatch) {
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
                   }))
    }
}

Tasks.prototype.parse_property = function (obj_box) {
    var self = this
    var key

    with (xmlmatch) {
        return M("property",
                 function (e) {
                     key = e.getAttribute("key")
                     console.debug("key", key)
                     return true
                 },
                 C((function () {
                     var list = []
                     return self.parse_object_list(list)})(),
                   M("#text",
                     function (e) {
                         var t = e.textContent
                         console.debug("#text", t)
                         var obj = obj_box[0]
                         obj.prop[key] = t
                         return true
                     })))
    }
}

Tasks.prototype.match_object = function () {
    var obj_box = []
    var self = this

    with (xmlmatch) {
        return ["object",
                function (e) {
                    var objid = e.getAttribute("object_id")
                    var obj = {prop: {}}
                    obj.id = objid
                    obj_box[0] = obj
                    console.debug("object_id", objid)
                    return true
                },
                C(self.parse_property(obj_box)),
                function () {
                    var obj = obj_box[0]
                    self.objects[obj.id] = obj
                    return true
                }]
    }
}

Tasks.prototype.match_snapshot_xml = function (data) {
    this.objects = {}

    var self = this

    with (xmlmatch) {
        var mat =
            M("snapshot",
              function (e) {
                  var state_id = e.getAttribute("state_id")
                  console.debug("state_id", state_id)
                  return true
              },
              C((function () {
                  return M.apply(this, self.match_object())})()))
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
