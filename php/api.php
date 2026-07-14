<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$config = require __DIR__ . '/config.php';
$host = $config['host'];
$db_name = $config['db_name'];
$username = $config['username'];
$password = $config['password'];

try {
    $conn = new PDO("mysql:host=$host;dbname=$db_name", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_AUTOCOMMIT, 0); // Ensures transactions work properly
    
    // Get the action from the query parameters
    $action = $_GET['action'] ?? 'overview';
    
    if ($action === 'overview') {
        // Company overview query
        $query = "SELECT 
            (SELECT COUNT(*) FROM employee WHERE emp_status = 'Active') AS active_employees,
            (SELECT COUNT(*) FROM potential_employee WHERE app_status = 'Interview Scheduled') AS pending_interviews,
            (SELECT COUNT(*) FROM product) AS total_products,
            (SELECT COUNT(*) FROM marketing_sites) AS sales_locations,
            (SELECT SUM(amount) FROM salary WHERE MONTH(pay_date) = MONTH(CURDATE())) AS current_month_payroll";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    } 
    else if ($action === 'interviewers') {
        // Query 1: Interviewers for Hellen Cole query
        $query = "SELECT DISTINCT ipm.member_id AS interviewer_id, CONCAT(p.f_name, ' ', p.l_name) AS interviewer_name
                FROM interview i
                JOIN person interviewee ON i.person_id = interviewee.person_id
                JOIN interview_panel_members ipm ON i.panel_id = ipm.panel_id
                JOIN person p ON ipm.member_id = p.person_id
                WHERE interviewee.f_name = 'Hellen' 
                AND interviewee.l_name = 'Cole'
                AND i.job_id = 11111";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }
        // Query 2: Sales department jobs from January 2011
    else if ($action === 'sales_jobs_jan_2011') {
        $query = "SELECT job_id, job_title, job_disc, date_posted
                FROM job_position
                WHERE dep = 'Sales'
                AND YEAR(date_posted) = 2011
                AND MONTH(date_posted) = 1";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 3: Employees with no supervisees
    else if ($action === 'employees_no_supervisees') {
        $query = "SELECT e.employee_id, CONCAT(p.f_name, ' ', p.l_name) AS employee_name, e.title
                FROM employee e
                JOIN person p ON e.employee_id = p.person_id
                WHERE e.employee_id NOT IN (
                    SELECT DISTINCT supervisor_id 
                    FROM employee 
                    WHERE supervisor_id IS NOT NULL
                )";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 4: Marketing sites with no sales in March 2011
    else if ($action === 'sites_no_sales_march_2011') {
        $query = "SELECT ms.site_id, ms.site_name, ms.site_location
                FROM marketing_sites ms
                WHERE ms.site_id NOT IN (
                    SELECT DISTINCT sp.site_id
                    FROM sell_products sp
                    WHERE YEAR(sp.sale_time) = 2011
                    AND MONTH(sp.sale_time) = 3
                )";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 5: Jobs with no hire one month after posting
    else if ($action === 'unfilled_jobs') {
        // Calculate the date one month ago
        $query = "SELECT j.job_id, j.job_title, j.job_disc, j.date_posted
                FROM job_position j
                WHERE j.job_id NOT IN (
                    SELECT DISTINCT af.job_id
                    FROM applies_for af
                    WHERE af.employee_id IS NOT NULL
                )
                AND j.date_posted <= (CURDATE() - INTERVAL 1 MONTH)";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 6: Salesmen who sold all product types priced above $200
    else if ($action === 'top_salesmen') {
        $query = "SELECT mse.employee_id, CONCAT(p.f_name, ' ', p.l_name) AS salesman_name
                FROM marketing_site_employee mse
                JOIN person p ON mse.employee_id = p.person_id
                WHERE NOT EXISTS (
                    SELECT DISTINCT pr.product_type
                    FROM product pr
                    WHERE pr.list_price > 200
                    AND pr.product_type NOT IN (
                        SELECT DISTINCT p2.product_type
                        FROM sell_products sp
                        JOIN ship_to st ON sp.site_id = st.site_id
                        JOIN product p2 ON st.product_id = p2.product_id
                        WHERE st.site_id = mse.site_id
                        AND p2.list_price > 200
                    )
                )";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 7: Departments with no job posts in January 2011
    else if ($action === 'inactive_departments') {
        $query = "SELECT 'HR' AS department, 101 AS dep_id
                FROM dual
                WHERE 'HR' NOT IN (
                    SELECT dep
                    FROM job_position
                    WHERE date_posted BETWEEN '2011-01-01' AND '2011-02-01'
                )
                UNION
                SELECT 'Manufacturing' AS department, 201 AS dep_id
                FROM dual
                WHERE 'Manufacturing' NOT IN (
                    SELECT dep
                    FROM job_position
                    WHERE date_posted BETWEEN '2011-01-01' AND '2011-02-01'
                )
                UNION
                SELECT 'Sales' AS department, 301 AS dep_id
                FROM dual
                WHERE 'Sales' NOT IN (
                    SELECT dep
                    FROM job_position
                    WHERE date_posted BETWEEN '2011-01-01' AND '2011-02-01'
                )";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 8: Existing employees who apply for job "12345"
    else if ($action === 'internal_applicants') {
        $query = "SELECT 
                e.employee_id, 
                CONCAT(p.f_name, ' ', p.l_name) AS employee_name, 
                e.current_dep,
                af.job_id
              FROM applies_for af
              JOIN employee e ON af.employee_id = e.employee_id
              JOIN person p ON e.employee_id = p.person_id
              WHERE af.job_id = 12345
              AND af.employee_id IS NOT NULL";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 9: Best selling product type
    else if ($action === 'best_selling_type') {
        $query = "SELECT p.product_type
                FROM product p
                JOIN ship_to st ON p.product_id = st.product_id
                JOIN sell_products sp ON st.site_id = sp.site_id
                GROUP BY p.product_type
                ORDER BY COUNT(sp.site_id) DESC
                LIMIT 1";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 10: Product type with highest net profit
    else if ($action === 'highest_profit_type') {
        $query = "SELECT p.product_type, SUM(p.list_price) - AVG(v4.total_part_cost) AS net_profit
                FROM product p
                JOIN view4_product_part_cost v4 ON p.product_id = v4.product_id
                GROUP BY p.product_type
                ORDER BY net_profit DESC
                LIMIT 1";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 11: Employees who have worked in all departments
    else if ($action === 'all_dept_employees') {
        $query = "SELECT e.employee_id, CONCAT(p.f_name, ' ', p.l_name) AS employee_name, e.all_dep
                FROM employee e
                JOIN person p ON e.employee_id = p.person_id
                WHERE e.all_dep LIKE '%HR%' 
                AND e.all_dep LIKE '%Manufacturing%' 
                AND e.all_dep LIKE '%Sales%'";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 12: Name and email of selected interviewees
    else if ($action === 'selected_interviewees') {
        $query = "SELECT p.f_name, p.l_name, pe.person_id, 
                CONCAT(LOWER(p.f_name), '.', LOWER(p.l_name), '@email.com') AS email
                FROM potential_employee pe
                JOIN person p ON pe.person_id = p.person_id
                WHERE pe.app_status = 'Offer Extended'
                OR pe.app_status = 'Hired'";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 13: Interviewees selected for all jobs they applied for
    else if ($action === 'selected_for_all') {
        $query = "SELECT p.f_name, p.l_name, p.p_num AS phone_number, CONCAT(LOWER(p.f_name), '.', LOWER(p.l_name), '@email.com') AS email
                FROM person p
                WHERE p.person_id IN (
                    SELECT pe.person_id
                    FROM potential_employee pe
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM applies_for af
                        WHERE af.person_id = pe.person_id
                        AND af.job_id NOT IN (
                            SELECT i.job_id
                            FROM interview i
                            JOIN grades g ON i.interview_id = g.interview_id
                            WHERE i.person_id = pe.person_id
                            AND g.grades >= 85
                        )
                    )
                )";
            
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 14: Employee with highest average monthly salary
    else if ($action === 'highest_salary_employee') {
        $query = "SELECT employee_id, employee_name, avg_monthly_salary
                FROM view1_avg_monthly_salary
                ORDER BY avg_monthly_salary DESC
                LIMIT 1";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'data' => $result
        ]);
    }

    // Query 15: Vendor supplying cheapest "Cup" part under 4 pounds
    else if ($action === 'cheapest_cup_vendor') {
        $query = "SELECT v.vendor_id, v.vendor_name, p.part_price, p.weight
                FROM vendors v
                JOIN supplies s ON v.vendor_id = s.vendor_id
                JOIN parts p ON s.part_id = p.part_id
                WHERE p.part_name = 'Cup'
                AND p.weight < 4
                ORDER BY p.part_price ASC
                LIMIT 1";
        
        $stmt = $conn->query($query);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if ($result) {
            echo json_encode([
                'status' => 'success',
                'data' => $result
            ]);
        } else {
            echo json_encode([
                'status' => 'success',
                'data' => null,
                'message' => 'No vendors found selling Cup parts under 4 pounds'
            ]);
        }
    }
    else if ($action === 'insert_customer') {
        try {
            // Get JSON data from request body
            $json = file_get_contents('php://input');
            $data = json_decode($json, true);
            
            // Validate required fields
            $required_fields = ['f_name', 'l_name', 'sex', 'b_day', 'p_num', 'street', 'city', 'state', 'zip', 'customer_email'];
            foreach ($required_fields as $field) {
                if (empty($data[$field])) {
                    throw new Exception("Missing required field: $field");
                }
            }
            
            $conn->beginTransaction();
            
            // Generate a new person_id
            // In production, you should use auto-increment, but here's a simple approach
            $query = "SELECT MAX(person_id) as max_id FROM person";
            $result = $conn->query($query);
            $row = $result->fetch(PDO::FETCH_ASSOC);
            $new_person_id = ($row['max_id'] ?? 0) + 1;
            
            // First insert into person table
            $query1 = "INSERT INTO person (person_id, f_name, m_init, l_name, sex, b_day, p_num, street, apt_no, city, state, zip)
                    VALUES (:person_id, :f_name, :m_init, :l_name, :sex, :b_day, :p_num, :street, :apt_no, :city, :state, :zip)";
            
            $stmt1 = $conn->prepare($query1);
            $stmt1->execute([
                ':person_id' => $new_person_id,
                ':f_name' => $data['f_name'],
                ':m_init' => $data['m_init'] ?? NULL,
                ':l_name' => $data['l_name'],
                ':sex' => $data['sex'],
                ':b_day' => $data['b_day'],
                ':p_num' => $data['p_num'],
                ':street' => $data['street'],
                ':apt_no' => $data['apt_no'] ?? NULL,
                ':city' => $data['city'],
                ':state' => $data['state'],
                ':zip' => $data['zip']
            ]);
            
            // Then insert into customers table
            $query2 = "INSERT INTO customers (person_id, sales_rep_id, customer_email)
                    VALUES (:person_id, :sales_rep_id, :customer_email)";
            
            $stmt2 = $conn->prepare($query2);
            $stmt2->execute([
                ':person_id' => $new_person_id,
                ':sales_rep_id' => $data['sales_rep_id'] ?? NULL,
                ':customer_email' => $data['customer_email']
            ]);
            
            $conn->commit();

            echo json_encode([
                'status' => 'success',
                'message' => 'Customer inserted successfully',
                'person_id' => $new_person_id
            ]);
        } catch (PDOException $e) {
            if (isset($conn) && $conn->inTransaction()) {
                $conn->rollBack();
            }
            error_log('insert_customer failed: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to insert customer.'
            ]);
        } catch (Exception $e) {
            if (isset($conn) && $conn->inTransaction()) {
                $conn->rollBack();
            }
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to insert customer: ' . $e->getMessage()
            ]);
        }
    }

    else if ($action === 'show_customers') {
    // Prevent caching
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    
    $query = "SELECT 
                p.f_name,
                p.l_name,
                p.m_init,
                c.customer_email,
                p.p_num AS phone_number,
                p.city,
                p.state
            FROM customers c
            JOIN person p ON c.person_id = p.person_id
            ORDER BY p.l_name, p.f_name";
    
    $stmt = $conn->query($query);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'status' => 'success',
        'data' => $result,
        'timestamp' => date('Y-m-d H:i:s') // Add timestamp to verify fresh data
    ]);
    }
    else if ($action === 'delete_customer') {
        try {
            // Get JSON data from request body
            $json = file_get_contents('php://input');
            $data = json_decode($json, true);

            // Validate required field
            if (empty($data['person_id'])) {
                throw new Exception("Missing required field: person_id");
            }
            
            $person_id = $data['person_id'];
            
            $conn->beginTransaction();
            
            // First check if the customer exists
            $checkQuery = "SELECT p.person_id, p.f_name, p.l_name, c.customer_email 
                        FROM person p 
                        JOIN customers c ON p.person_id = c.person_id 
                        WHERE p.person_id = :person_id";
            $checkStmt = $conn->prepare($checkQuery);
            $checkStmt->execute([':person_id' => $person_id]);
            $customer = $checkStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$customer) {
                throw new Exception("Customer with ID $person_id not found");
            }
            
            // First delete from customers table (due to foreign key constraint)
            $query1 = "DELETE FROM customers WHERE person_id = :person_id";
            $stmt1 = $conn->prepare($query1);
            $stmt1->execute([':person_id' => $person_id]);
            
            // Then delete from person table
            $query2 = "DELETE FROM person WHERE person_id = :person_id";
            $stmt2 = $conn->prepare($query2);
            $stmt2->execute([':person_id' => $person_id]);
            
            $conn->commit();
            
            echo json_encode([
                'status' => 'success',
                'message' => "Customer {$customer['f_name']} {$customer['l_name']} removed successfully",
                'deleted_customer' => $customer
            ]);
        } catch (PDOException $e) {
            if (isset($conn) && $conn->inTransaction()) {
                $conn->rollBack();
            }
            error_log('delete_customer failed: ' . $e->getMessage());
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to remove customer.'
            ]);
        } catch (Exception $e) {
            if (isset($conn) && $conn->inTransaction()) {
                $conn->rollBack();
            }
            echo json_encode([
                'status' => 'error',
                'message' => 'Failed to remove customer: ' . $e->getMessage()
            ]);
        }
    }

// Optional: Add a new action to get customer list for the dropdown
else if ($action === 'get_customers') {
    try {
        $query = "SELECT p.person_id, p.f_name, p.l_name, c.customer_email 
                  FROM person p 
                  JOIN customers c ON p.person_id = c.person_id 
                  ORDER BY p.l_name, p.f_name";
        $stmt = $conn->prepare($query);
        $stmt->execute();
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'status' => 'success',
            'customers' => $customers
        ]);
    } catch (PDOException $e) {
        error_log('get_customers failed: ' . $e->getMessage());
        echo json_encode([
            'status' => 'error',
            'message' => 'Failed to fetch customers.'
        ]);
    }
}

    else {
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid action'
        ]);
    }
    
} catch(PDOException $e) {
    error_log('api.php failed: ' . $e->getMessage());
    echo json_encode([
        'status' => 'error',
        'message' => 'A database error occurred.'
    ]);
}
?>