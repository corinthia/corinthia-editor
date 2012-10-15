var ChangeTracking_showChanges;
var ChangeTracking_trackChanges;
var ChangeTracking_setShowChanges;
var ChangeTracking_setTrackChanges;

(function() {

    var showChangesEnabled = false;
    var trackChangesEnabled = false;

    ChangeTracking_showChanges = trace(function showChanges()
    {
        return showChangesEnabled;
    });

    ChangeTracking_trackChanges = trace(function trackChanges()
    {
        return trackChangesEnabled;
    });

    ChangeTracking_setShowChanges = trace(function setShowChanges(enabled)
    {
        showChangesEnabled = enabled;
    });

    ChangeTracking_setTrackChanges = trace(function setTrackChanges(enabled)
    {
        trackChangesEnabled = enabled;
    });

})();
