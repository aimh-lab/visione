package it.cnr.isti.visione.logging;

import java.util.Comparator;
import java.util.concurrent.TimeUnit;



public class Tools {
	
	public static String convertTimeToVBSFormat(String time) {
		long timestamp = (long) (Double.parseDouble(time)*1000);
        long hours = TimeUnit.MILLISECONDS.toHours(timestamp);
        timestamp -= TimeUnit.HOURS.toMillis(hours);
        long minutes = TimeUnit.MILLISECONDS.toMinutes(timestamp);
        timestamp -= TimeUnit.MINUTES.toMillis(minutes);
        long seconds = TimeUnit.MILLISECONDS.toSeconds(timestamp);
        timestamp -= TimeUnit.SECONDS.toMillis(seconds);
//        long hundredths = timestamp/10;
        long hundredths = 0;

		return String.format("%02d:%02d:%02d:%02d", hours, minutes, seconds, hundredths);
	}
/*	
	public class Comp implements Comparator<String> {

		public int compare(String o1, String o2) {
			int num1 = Integer.parseInt(o1.split("_")[1].split("\\.")[0]);
			int num2 = Integer.parseInt(o2.split("_")[1].split("\\.")[0]);
			if (num1 > num2) {
				return 1;
			} else if (num1 < num2) {
				return -1;
			} else {
				return 0;
			}
		}
	}
*/
	
	public class Comp implements Comparator<String[]> {

		public int compare(String[] o1, String[] o2) {
			if (Float.parseFloat(o1[1]) > Float.parseFloat(o2[1]))
				return 1;
			else if (Float.parseFloat(o1[1]) == Float.parseFloat(o2[1]))
				return 0;
			
			return -1;
		}
	}

}
