Tasks = function() {
}

$(document).ready(function() {
    var body = $("body")

    var tasks = new Tasks

    var ta = $("<textarea>")
    var form = $("<form>").append(ta).append($("<input type='submit'>"))
    body.append(form)
    form.submit(function(ev) {
        var mesg = ta.val()
        ta.val("")
        console.debug("submit", mesg, ev)
        try {
            tasks.send_message(mesg)
        } catch (e) {
            console.debug("error", e)
        }
        return false
    })

    $.ajax({url: "/snapshot/",
            success: function(data, text_status, jqXHR) {
                console.debug(data, text_status, jqXHR)

                tasks.match_snapshot_xml(data)

                console.debug(tasks)
            }})
})

Tasks.prototype.parse_object_list = function (obj_box, key_box) {
    var list = []
    with (xmlmatch) {
        return M("object_list",
                 C(M("object_ref",
                     function (e) {
                         var id = e.getAttribute("object_id")
                         list.push(id)
                         return true
                     })),
                 function (e) {
                     obj_box[0].prop[key_box[0]] = list
                     return true
                 })
    }
}

Tasks.prototype.parse_property = function (obj_box) {
    var self = this
    var key_box = []

    with (xmlmatch) {
        return M("property",
                 function (e) {
                     key_box[0] = e.getAttribute("key")
                     return true
                 },
                 C((function () {
                     return self.parse_object_list(obj_box, key_box)})(),
                   M("#text",
                     function (e) {
                         var t = e.textContent
                         var obj = obj_box[0]
                         obj.prop[key_box[0]] = t
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

    var tasks = this.get_tasks()
    console.debug("Tasks", tasks)

    var container = $("<div class='row'>")
    var body = $("body")
    body.append(container)

    for (var i = 0; i < tasks.length; i ++) {
        var o = tasks[i].prop
        var item = $("<div class='span12' style='border:solid #eef;margin-top:1ex'>").
            append($("<div class='span8'>").
                   text(o.title)).
            append($("<div class='span1'>").
                   append($("<input class='btn-success' type='submit' value='done'>"))).
            append($("<div class='span4'>").
                   text(new Date(parseInt(o.created)).toString()))
        container.append(item)
    }
}

Tasks.prototype.get_tasks = function () {
    if (this.objects && this.objects.task_list.prop.tasks) {
        var list = []
        var ids = this.objects.task_list.prop.tasks
        for (var i = 0; i < ids.length; i ++) {
            var id = ids[i]
            list.push(this.objects[id])
        }
        return list
    } else {
        return []
    }
}

Tasks.prototype.send_message =  function (mesg) {
    var objid = Date.now() + "." + Math.floor(Math.random() * 10000000)
    var new_obj_elem = E_("new_object", {object_id: objid},
                          E_("property", {key: "title"}, mesg),
                          E_("property", {key: "state"}, "todo"),
                          E_("property", {key: "created"}, Date.now()),
                          E_("property", {key: "modified"}, Date.now()))
    var add_to_list_elem
    if (this.objects.task_list) {
        var task_list = this.objects.task_list.prop.tasks
        task_list.push(objid)
        console.debug("task added", task_list)
        add_to_list_elem = E_("update_object", {object_id: "task_list"},
                              E_("property", {key: "tasks"},
                                 E_("object_list", {},
                                    (function () {
                                        var elems = []
                                        for (var i = 0; i < task_list.length; i ++) {
                                            elems.push(E_("object_ref",
                                                          {object_id: task_list[i]}))
                                        }
                                        return elems
                                    })())))
    } else {
        var task_list = [objid]
        add_to_list_elem = E_("new_object", {object_id: "task_list"},
                              E_("property", {key: "tasks"},
                                 E_("object_list", {},
                                    (function () {
                                        var elems = []
                                        for (var i = 0; i < task_list.length; i ++) {
                                            elems.push(E_("object_ref",
                                                          {object_id: task_list[i]}))
                                        }
                                        return elems
                                    })())))
    }
    var e = E_("x", {},
               E_("updates", {},
                  new_obj_elem,
                  add_to_list_elem
                  ))
    var elem = e(document)
    var xml = elem.innerHTML

    var data = "update=" + encodeURI(xml)
    console.debug(data)

    $.ajax({url: "/push",
            type: "POST",
            data: data})
}
