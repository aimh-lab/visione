package it.cnr.isti.visione.logging;

import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;

import org.openapitools.client.model.QueryEventLog;
import org.openapitools.client.model.QueryResultLog;
import org.openapitools.client.model.SuccessStatus;

import dev.dres.ApiException;

public class DRESFakeClient {
	
	private String sessionId = "nudd";
	
	public DRESFakeClient() {
	}
	
	public String getSessionId() {
		return sessionId;
	}
	
	public String dresSubmitResultByTime(String video, String timestamp) throws ApiException {
        return "";
	}

	
	public String dresSubmitResultByFrameNumber(String video, int frameNumber) throws ApiException {
        return "";
	}
	
	public void dresSubmitQuery(QueryEventLog eventLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
	}
	
	public void dresSubmitLog(QueryResultLog resultLog) throws KeyManagementException, NoSuchAlgorithmException, NumberFormatException {
	}
	
	public SuccessStatus dresLogout() throws ApiException {
        return null;
	}
	
}
