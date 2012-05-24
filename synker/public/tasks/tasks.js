Tasks = function(key) {
    this.app_key = key
}

$(document).ready(function() {
    start ("hogetask")

    // Enable pusher logging - don't include this in production
    Pusher.log = function(message) {
      if (window.console && window.console.log) window.console.log(message);
    };

    // Flash fallback logging - don't include this in production
    WEB_SOCKET_DEBUG = true;

    var pusher = new Pusher('006215e5138bd3a75e84');
    var channel = pusher.subscribe('test_channel');
    channel.bind('my_event', function(data) {
      alert(data);
    });

})

function start (app_key) {
    var body = $("#body-container")
    $("body").css("background-color", "lightgray")

    var tasks = new Tasks (app_key)

    body.append($("<div class='navbar'>").
                append($("<div class='navbar-inner'>").
                       append($("<div class='container'>").
                              append($("<a class='brand'>").text("Tasks")))))

    var ta
    var form

    body.append(form = $("<form class='well form-inline'>").
                append(ta = $("<input type='text' class='input-xxlarge' placeholder='To do'>")).
                append($("<button type='submit' class='btn'>").
                       text("Add Task")))

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
                // console.debug(data, text_status, jqXHR)

                tasks.match_snapshot_xml(data)
                tasks.construct_task_list()

                // console.debug(tasks)
            }})
}

function box (container, content) {
    container[0] = content
}

function unbox (container) {
    return container[0]
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
                     unbox (obj_box).set_property (unbox (key_box), list)
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
                     box (key_box, e.getAttribute("key"))
                     return true
                 },
                 C((function () {
                     return self.parse_object_list(obj_box, key_box)})(),
                   M("#text",
                     function (e) {
                         var t = e.textContent
                         var obj = unbox (obj_box)
                         obj.set_property (unbox (key_box), t)

                         return true
                     })))
    }
}

TaskItem = function (id) {
    console.debug ("new obj", id)
    this.id = id
    this.prop = {}
}

TaskItem.prototype.set_property = function (prop, value) {
    this.prop[prop] = value
}

TaskItem.prototype.get_property = function (prop) {
    return this.prop[prop]
}

TaskItem.prototype.set_state = function (value) {
    this.prop.state = value
}

Tasks.prototype.match_object = function () {
    var obj_box = []
    var self = this

    with (xmlmatch) {
        return ["object",
                function (e) {
                    var objid = e.getAttribute("object_id")
                    var obj = new TaskItem (objid)

                    box (obj_box, obj)
                    return true
                },
                C(self.parse_property(obj_box)),
                function () {
                    var obj = unbox (obj_box)
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
        // console.debug("res", res)
    }
}

Tasks.prototype.update_task_state = function (task, state) {
    console.debug("clicked", state)
    task.set_state (state)
    var e = E_("updates", {},
               E_("update_object", {object_id: task.id},
                  E_("property", {key: "state"}, state),
                  E_("property", {key: "modified"}, Date.now())))

    this.send_ajax(e)
}

function date_string(date) {
    var y = date.getFullYear()
    var m = date.getMonth() + 1
    var d = date.getDate()
    var h = date.getHours()
    var min = date.getMinutes()

    return [m, d, y].join("/") + " " + [h, min].join(":")
}

Tasks.prototype.create_item_element = function (task_obj) {
    var item = $("<div class='span3' style='background-color:white;margin-top:1ex'>").
        attr("id", "task-" + task_obj.id).
        append($("<div>").
               append($("<p class='task-title'>").text(task_obj.get_property ("title"))).
               append($("<p>").
                      append($("<small>").
                             text(date_string(new Date(parseInt(task_obj.get_property ("created"))))))))

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
    // console.debug("Tasks", tasks)

    var body = $("#body-container")

    var todo_container = $("<div class='row tasks-todo'>")

    body.append($("<h2>").text("TODO"))
    body.append(todo_container)

    var pending_container = $("<div class='row tasks-pending'>")

    body.append($("<h2>").text("PENDING"))
    body.append(pending_container)

    var done_container = $("<div class='row tasks-done'>")

    body.append($("<h2>").text("DONE"))
    body.append(done_container)

    for (var i = 0; i < tasks.length; i ++) {
        var item = this.create_item_element(tasks[i])
        var stat = tasks[i].get_property ("state")

        if (stat == "todo") {
            var done = $("<a class='btn btn-success' href='#'>").text("Done")
            var suspend = $("<a class='btn btn-warning' href='#'>").text("Suspend")
            item.append($("<div style='padding-left:3ex'>").append(done).append(suspend))

            this.bind_state_to_button(done, tasks[i], "done")
            this.bind_state_to_button(suspend, tasks[i], "pending")

            todo_container.append(item)
        } else if (stat == "pending") {
            var resume = $("<a class='btn btn-primary' href='#'>").text("Resume")
            item.append($("<div style='padding-left:3ex'>").append(resume))
            this.bind_state_to_button(resume, tasks[i], "todo")

            pending_container.append(item)
        } else if (stat == "done") {
            done_container.append(item)
        }
    }

    this.containers = {todo: todo_container,
                       pending: pending_container,
                       done: done_container}
}

Tasks.prototype.get_container = function (label) {
    if (this.containers == null) {
        return null
    } else {
        return this.containers[label]
    }
}

Tasks.prototype.get_tasks = function () {
    var dest = []

    if (this.objects && this.objects.task_list.get_property ("tasks")) {
        var ids = this.objects.task_list.get_property ("tasks")
        for (var i = 0; i < ids.length; i ++) {
            var id = ids[i]
            var obj = this.objects[id]

            dest.push(obj)
        }

        dest.sort (function (a, b) {
            try {
                return parseInt (b.get_property ("modified"))
                    - parseInt (a.get_property ("modified"))
            } catch (e) {
                console.log ("doesn't have modified date", a, b)
                return 0
            }
        })
    }

    return dest
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
        var task_list = this.objects.task_list.get_property ("tasks")
        task_list.push(objid)
        // console.debug("task added", task_list)
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

// Local Variables:
// indent-tabs-mode: nil
// tab-width: 8
// End:
