var client = AgoraRTC.createClient({ mode: "rtc", codec: "h264" });
var client2 = AgoraRTC.createClient({ mode: "rtc", codec: "h264" });

var localTracks = {
  videoTrack: null,
  screenTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = { 
  appid: null,
  channel: null,
  uid: null,
  token: null,
  uid_screen: null,
  token_screen: null,
  cameraid: null,
  microphoneid: null
};

var urlParams;

// the demo can auto join channel with params in url
$(() => {
  urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  options.cameraid = urlParams.get("camerasource");
  options.microphoneid = urlParams.get("audiosource");
  if (options.appid && options.channel) {
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#camerasource").val(options.cameraid);
    $("#audiosource").val(options.microphoneid);
    $("#join-form").submit();
  }
  getDevices();
})

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    options.cameraid = urlParams.get("camerasource");
    options.microphoneid = urlParams.get("audiosource");
    await join();
    if(options.token) {
      $("#success-alert-with-token").css("display", "block");
    } else {
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      $("#success-alert").css("display", "block");
    }
  } catch (error) {
    console.error(error);
    
  } finally {
    $("#leave").attr("disabled", false);
  }
})

$("#leave").click(function (e) {
  leave();
})

$("#screensharing").click(function (e) {
  screensharing();
})


async function screensharing() {

  [ localTracks.screenTrack ] = await Promise.all([
    AgoraRTC.createScreenVideoTrack({encoderConfig: {width: {max: 1280} , height: {max: 720}, frameRate: 30}},"disable")
  ]);
  localTracks.screenTrack.on("track-ended", handleTrackEnded);
  localTracks.screenTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid_screen})`);

  // publish local tracks to channel
  await client2.publish(localTracks.screenTrack);
  console.log("publish success");

}


async function join() {

  await join_camera();
  await join_screen();

}

async function join_camera() {

  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack({microphoneId: options.microphoneid}),
    AgoraRTC.createCameraVideoTrack({cameraId: options.cameraid}),
  ]);

  // add event listener to stop screen share
  localTracks.videoTrack.on("track-ended", handleTrackEnded);

  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);

  // publish local tracks to channel
  await client.publish(Object.values([localTracks.audioTrack, localTracks.videoTrack]));
  console.log("publish success");

}

async function join_screen() {

  console.log("join_screen");
  // add event listener to play remote tracks when remote user publishs.
  client2.on("user-published", handleUserPublished);
  client2.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid_s, localTracks.screenTrack] = await Promise.all([
    // join the channel
    client2.join(options.appid, options.channel, options.token || null),
    AgoraRTC.createScreenVideoTrack({encoderConfig: {width: {max: 1280} , height: {max: 720}, frameRate: 30}},"disable")
  ]);

  // add event listener to stop screen share
  localTracks.screenTrack.on("track-ended", handleTrackEnded);

  // play local video track
  localTracks.screenTrack.play("local-screen");
  $("#local-screen-name").text(`localVideo(${options.uid_s})`);
  console.log("publish success1");
  // publish local tracks to channel
  await client2.publish(localTracks.screenTrack);
  console.log("publish success2");

}


async function leave() {

  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();
  await client2.leave();

  $("#local-player-name").text("");
  $("#local-screen-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  //subscribe(user, mediaType);
  console.log("handleUserPublished");
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
  console.log("handleUserUnpublished");
}

function handleTrackEnded() {

  var track = localTracks["screenTrack"];
  if(track) {
    track.stop();
    track.close();
    localTracks["screenTrack"] = undefined;
  }
  $("#local-screen-name").text("");
  client2.unpublish(track);
  console.log("handleTrackEnded");
}

function getDevices() {
  AgoraRTC.getDevices().then(devices => {
    var len= devices.length;
    var audioSelect = document.querySelector('#audioSource');
    var videoSelect = document.querySelector('#videoSource');

    for (var i = 0; i !== len; ++i) {
      var device = devices[i];
      var option = document.createElement('option');
      option.value = device.deviceId;
      if (device.kind === 'audioinput') {
        console.log('device.kind: ', device.kind);
        option.text = device.label || 'microphone ' + (audioSelect.length + 1);
        audioSelect.appendChild(option);
      } else if (device.kind === 'videoinput') {
        console.log('device.kind: ', device.kind);
        option.text = device.label || 'camera ' + (videoSelect.length + 1);
        videoSelect.appendChild(option);
      } else {
        console.log('Some other kind of source/device: ', device);
      }
    }

  }).catch(e => {
  console.log("get devices error!", e);
  });
}

