
package it.cnr.isti.visione.logging;

import java.util.List;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

public class Event {

@SerializedName("timestamp")
@Expose
private long timestamp;
@SerializedName("actions")
@Expose
private List<Action> actions = null;
@SerializedName("category")
@Expose
private String category;
@SerializedName("type")
@Expose
private String type;
@SerializedName("value")
@Expose
private String value;
@SerializedName("attributes")
@Expose
private String attributes;

public long getTimestamp() {
return timestamp;
}

public void setTimestamp(long timestamp) {
this.timestamp = timestamp;
}

public List<Action> getActions() {
return actions;
}

public void setActions(List<Action> actions) {
this.actions = actions;
}

public String getCategory() {
return category;
}

public void setCategory(String category) {
this.category = category;
}

public String getType() {
return type;
}

public void setType(String type) {
this.type = type;
}

public String getValue() {
return value;
}

public void setValue(String value) {
this.value = value;
}

public String getAttributes() {
return attributes;
}

public void setAttributes(String attributes) {
this.attributes = attributes;
}

}
