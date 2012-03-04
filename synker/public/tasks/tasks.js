Tasks = function(key) {
    this.app_key = key
}

$(document).ready(function() {
    start ("hogetask")
})

function start (app_key) {
    var body = $("body")
    body.css("background-color", "lightgray")

    var tasks = new Tasks (app_key)

    body.append($("<div class='navbar'>").
                append($("<div class='navbar-inner'>").
                       append($("<div class='container'>").
                              append($("<a class='brand'>").text("Tasks")))))

    var ta = $("<input type='text' class='input-xxlarge' placeholder='To do'>")
    var form = $("<form class='well form-search'>").
        append(ta).
        append($("<button type='submit' class='btn'>").
               text("Add Task"))

    body.append($("<div class='row'>").
                append($("<div class='span12'>").
                       append(form)))

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

    $.ajax({url: "/snapshot/" + app_key,
            success: function(data, text_status, jqXHR) {
                console.debug(data, text_status, jqXHR)

                tasks.match_snapshot_xml(data)
                tasks.construct_task_list()

                console.debug(tasks)
            }})
}

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
                     obj_box[0].set_property (key_box[0], list)
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
                         obj.set_property (key_box[0], t)

                         return true
                     })))
    }
}

TaskItem = function (id) {        // TODO
    console.debug ("new obj", id)
    this.id = id
    this.prop = {}
}

TaskItem.prototype.set_property = function (prop, value) {
    this.prop[prop] = value
}

Tasks.prototype.match_object = function () {
    var obj_box = []
    var self = this

    with (xmlmatch) {
        return ["object",
                function (e) {
                    var objid = e.getAttribute("object_id")
                    var obj = new TaskItem (objid)

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
}

Tasks.prototype.update_task_state = function (task, state) {
    console.debug("clicked", state)
    task.prop.state = state
    var e = E_("updates", {},
               E_("update_object", {object_id: task.id},
                  E_("property", {key: "state"}, state),
                  E_("property", {key: "modified"}, Date.now())))

    this.send_ajax(e)
}

Tasks.prototype.draw_item = function (task_obj) {
    var o = task_obj.prop
    var item = $("<div class='span3' style='background-color:white;margin-top:1ex'>").
        append($("<div>").
               append($("<h3>").text(o.title)).
               append($("<p>").
                      append($("<small>").
                             text(new Date(parseInt(o.created)).toString()))))

    return item
}

Tasks.prototype.bind_state_to_button = function (btn, task_obj, state) {
    var self = this

    btn.click(function (ev) {
        self.update_task_state(task_obj, state)
        return false
    })
}

Tasks.prototype.construct_task_list = function () {
    var self = this

    var tasks = this.get_tasks()
    console.debug("Tasks", tasks)

    var body = $("body")

    var todo_container = $("<div class='row'>")
    var todo_tasks = tasks.todo
    body.append($("<h2>").text("TODO"))
    body.append(todo_container)

    for (var i = 0; i < todo_tasks.length; i ++) {
        var done = $("<a class='btn btn-success' href='#'>").text("Done")
        var suspend = $("<a class='btn btn-warning' href='#'>").text("Suspend")
        var item = this.draw_item(todo_tasks[i]).
            append($("<div style='padding-left:3ex'>").append(done).append(suspend))
        todo_container.append(item)

        this.bind_state_to_button(done, todo_tasks[i], "done")
        this.bind_state_to_button(suspend, todo_tasks[i], "pending")
    }

    var pending_container = $("<div class='row'>")
    var pending_tasks = tasks.pending
    body.append($("<h2>").text("PENDING"))
    body.append(pending_container)

    for (var i = 0; i < pending_tasks.length; i ++) {
        var resume = $("<a class='btn btn-primary' href='#'>").text("Resume")
        var item = this.draw_item(pending_tasks[i]).
            append($("<div style='padding-left:3ex'>").append(resume))
        pending_container.append(item)

        this.bind_state_to_button(resume, pending_tasks[i], "todo")
    }

    var done_container = $("<div class='row'>")
    var done_tasks = tasks.done
    body.append($("<h2>").text("DONE"))
    body.append(done_container)

    for (var i = 0; i < done_tasks.length; i ++) {
        var item = this.draw_item(done_tasks[i])
		item.append($("<p>").
                    append($("<small>").
                           text(new Date(parseInt(done_tasks[i].prop.modified)).toString())))
        done_container.append(item)
    }
}

Tasks.prototype.get_tasks = function () {
    var todo_list = []
    var pending_list = []
    var done_list = []

    if (this.objects && this.objects.task_list.prop.tasks) {
        var ids = this.objects.task_list.prop.tasks
        for (var i = 0; i < ids.length; i ++) {
            var id = ids[i]
            var obj = this.objects[id]
            if (obj.prop.state == "todo")
                todo_list.push(obj)
            else if (obj.prop.state == "pending")
                pending_list.push(obj)
            else if (obj.prop.state == "done")
                done_list.push(obj)
        }

		done_list.sort (function (a, b) {
			try {
				return parseInt(b.prop.modified) - parseInt(a.prop.modified)
			} catch (e) {
				console.log("doesn't have modified date", a, b)
				return 0
			}
		})
    }

    return {todo: todo_list, pending: pending_list, done: done_list}
}

Tasks.prototype.send_ajax = function (xmlelem) {
    var elem = E_("x", {}, xmlelem)(document)
    var xml = elem.innerHTML

    var data = {"key": this.app_key, "update": xml}
    $.ajax({url: "/push",
            type: "POST",
            data: data})
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
    var e = E_("updates", {},
               new_obj_elem,
               add_to_list_elem
              )

    this.send_ajax(e)
}
