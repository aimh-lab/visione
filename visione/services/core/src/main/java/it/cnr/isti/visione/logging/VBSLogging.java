
package it.cnr.isti.visione.logging;

import java.util.List;

import org.openapitools.client.model.QueryEventLog;
import org.openapitools.client.model.QueryResult;
import org.openapitools.client.model.QueryResultLog;

import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;

public class VBSLogging {

	@SerializedName("timestamp")
	@Expose
	private long timestamp;
	@SerializedName("type")
	@Expose
	private String type;
	@SerializedName("events")
	@Expose
	private List<QueryEventLog> events = null;

	@SerializedName("results")
	@Expose
	private List<QueryResultLog> results = null;

	public long getTimestamp() {
		return timestamp;
	}

	public void setTimestamp(long timestamp) {
		this.timestamp = timestamp;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public List<QueryEventLog> getEvents() {
		return events;
	}

	public void setEvents(List<QueryEventLog> events) {
		this.events = events;
	}

	public List<QueryResultLog> getResults() {
		return results;
	}

	public void setResults(List<QueryResultLog> results) {
		this.results = results;
	}

}
